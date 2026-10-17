import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SubscriptionSuspendedError,
  isSubscriptionGateError,
} from "@/modules/billing/domain/access";
import { NoActiveCohortError, isNoActiveCohortError } from "@/modules/learning/domain/errors";
import { parseLessonPath, type LessonPathEntry } from "@/modules/learning/domain/access";
import type {
  LearningCourse,
  LearningLesson,
  LearningModule,
  LearningRepository,
  LessonProgressInput,
  LessonProgressSnapshot,
  LessonTextContent,
  LessonContentAsset,
} from "@/modules/learning";

function progressFromRow(row: Record<string, unknown>): LessonProgressSnapshot {
  return {
    id: String(row.id),
    enrollmentId: String(row.enrollment_id),
    lessonId: String(row.lesson_id),
    userId: String(row.user_id),
    status: row.status as LessonProgressSnapshot["status"],
    completionPercent: Number(row.completion_percent),
    lastPositionSeconds:
      row.last_position_seconds === null || row.last_position_seconds === undefined
        ? null
        : Number(row.last_position_seconds),
    startedAt: row.started_at ? String(row.started_at) : null,
    lastAccessedAt: String(row.last_accessed_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    updatedAt: String(row.updated_at),
  };
}

function parseLessonContent(value: unknown): LessonTextContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.body !== "string") return null;

  return {
    eyebrow: typeof record.eyebrow === "string" ? record.eyebrow : null,
    title: record.title,
    body: record.body,
    steps: Array.isArray(record.steps)
      ? record.steps.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export class SupabaseLearningRepository implements LearningRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getLessonAssetsForStudent(
    _userId: string,
    lessonId: string,
  ): Promise<LessonContentAsset[]> {
    const { data, error } = await this.client
      .from("lesson_assets")
      .select("id,asset_type,position,content")
      .eq("lesson_id", lessonId)
      .eq("publication_status", "PUBLISHED")
      .order("position")
      .order("id");
    if (error) throw new Error("Unable to load lesson assets.");
    const assets: LessonContentAsset[] = [];
    for (const row of data ?? []) {
      const base = { id: String(row.id), position: Number(row.position) };
      if (row.asset_type === "TEXT") {
        const content = parseLessonContent(row.content);
        if (content) assets.push({ ...base, type: "TEXT", content });
      } else if (row.asset_type === "VIDEO") assets.push({ ...base, type: "VIDEO" });
      else if (
        row.asset_type === "PDF" ||
        row.asset_type === "AUDIO" ||
        row.asset_type === "LINK" ||
        row.asset_type === "EXERCISE"
      )
        assets.push({ ...base, type: row.asset_type });
    }
    return assets;
  }

  async getActiveCoursesForStudent(userId: string): Promise<LearningCourse[]> {
    const { data: enrollmentRows, error: enrollmentError } = await this.client
      .from("enrollments")
      .select("id, course_id, status, completed_at")
      .eq("user_id", userId)
      // ADR 0018: a COMPLETED enrollment keeps read access, so the course stays listed.
      .in("status", ["ACTIVE", "COMPLETED"]);

    if (enrollmentError) throw new Error("Unable to load enrollments.");
    if (!enrollmentRows || enrollmentRows.length === 0) return this.getWelcomeCourses(userId);

    const courseIds = enrollmentRows.map((row) => String(row.course_id));
    const completedAtByCourse = new Map(
      enrollmentRows.map((row) => [
        String(row.course_id),
        row.status === "COMPLETED" && typeof row.completed_at === "string"
          ? row.completed_at
          : null,
      ]),
    );

    const [{ data: courseRows, error: courseError }, { data: moduleRows, error: moduleError }] =
      await Promise.all([
        this.client
          .from("courses")
          .select("id, slug, title, description")
          .in("id", courseIds)
          .eq("active", true)
          .eq("publication_status", "PUBLISHED")
          .order("slug")
          .order("id"),
        this.client
          .from("modules")
          .select("id, course_id, position, title, description")
          .in("course_id", courseIds)
          .eq("publication_status", "PUBLISHED")
          .order("position")
          .order("id"),
      ]);

    if (courseError || moduleError) throw new Error("Unable to load course structure.");

    const moduleIds = (moduleRows ?? []).map((row) => String(row.id));
    const lessonResult =
      moduleIds.length === 0
        ? { data: [], error: null }
        : await this.client
            .from("lessons")
            .select("id, module_id, position, slug, title, estimated_minutes")
            .in("module_id", moduleIds)
            .eq("publication_status", "PUBLISHED")
            .order("position")
            .order("id");

    if (lessonResult.error) throw new Error("Unable to load lessons.");
    const lessonRows = lessonResult.data ?? [];

    const { data: progressRows, error: progressError } = await this.client
      .from("lesson_progress")
      .select(
        "id, enrollment_id, lesson_id, user_id, status, completion_percent, last_position_seconds, started_at, last_accessed_at, completed_at, updated_at",
      )
      .eq("user_id", userId);

    if (progressError) throw new Error("Unable to load lesson progress.");

    const progressByLesson = new Map(
      (progressRows ?? []).map((row) => [String(row.lesson_id), progressFromRow(row)]),
    );

    // One path RPC per course, in parallel. The path decides which lessons the student sees,
    // their cohort order and why a lesson is locked (state + effective release date).
    const visibleCourseIds = (courseRows ?? []).map((row) => String(row.id));
    const pathResults = await Promise.all(
      visibleCourseIds.map(async (courseId) => {
        const { data, error } = await this.client.rpc("get_student_learning_path", {
          p_course_id: courseId,
        });
        if (error) throw new Error("Unable to load learning path.");
        return parseLessonPath(data);
      }),
    );
    const pathByLesson = new Map<string, LessonPathEntry>();
    for (const entries of pathResults)
      for (const [id, entry] of entries) pathByLesson.set(id, entry);
    const coursesWithPath = new Set(
      visibleCourseIds.filter((_, index) => (pathResults[index]?.size ?? 0) > 0),
    );
    const courseByModule = new Map(
      (moduleRows ?? []).map((row) => [String(row.id), String(row.course_id)]),
    );
    const hasPathFor = (moduleId: string) =>
      coursesWithPath.has(courseByModule.get(moduleId) ?? "");

    const lessonsByModule = new Map<string, LearningLesson[]>();
    const orderedRows = lessonRows
      .filter((row) => !hasPathFor(String(row.module_id)) || pathByLesson.has(String(row.id)))
      .sort((a, b) => {
        const pa = pathByLesson.get(String(a.id))?.position;
        const pb = pathByLesson.get(String(b.id))?.position;
        return pa !== undefined && pb !== undefined ? pa - pb : 0;
      });
    for (const row of orderedRows) {
      const moduleId = String(row.module_id);
      const access = pathByLesson.get(String(row.id))?.access;
      const lesson: LearningLesson = {
        ...(access ? { access } : {}),
        id: String(row.id),
        moduleId,
        position: Number(row.position),
        slug: String(row.slug),
        title: String(row.title),
        estimatedMinutes:
          row.estimated_minutes === null || row.estimated_minutes === undefined
            ? null
            : Number(row.estimated_minutes),
        progress: progressByLesson.get(String(row.id)) ?? null,
      };
      const current = lessonsByModule.get(moduleId) ?? [];
      current.push(lesson);
      lessonsByModule.set(moduleId, current);
    }

    const modulesByCourse = new Map<string, LearningModule[]>();
    for (const row of moduleRows ?? []) {
      const courseId = String(row.course_id);
      const courseModule: LearningModule = {
        id: String(row.id),
        courseId,
        position: Number(row.position),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        // Path order already applied above; keep module-local order for courses without a path.
        // With a cohort path the order is the path order; renumber so every position-based sort
        // downstream (home, progress, navigation) keeps the cohort order.
        lessons: hasPathFor(String(row.id))
          ? (lessonsByModule.get(String(row.id)) ?? []).map((lesson, index) => ({
              ...lesson,
              position: index + 1,
            }))
          : (lessonsByModule.get(String(row.id)) ?? []).sort((a, b) => a.position - b.position),
      };
      const current = modulesByCourse.get(courseId) ?? [];
      current.push(courseModule);
      modulesByCourse.set(courseId, current);
    }

    return (courseRows ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      modules: (modulesByCourse.get(String(row.id)) ?? []).sort((a, b) => a.position - b.position),
      completedAt: completedAtByCourse.get(String(row.id)) ?? null,
    }));
  }

  /**
   * Catalog for a paying student who is still waiting for the placement review. Row-level security only
   * returns lessons an Admin flagged as welcome (and only in the pre-enrollment placement states), so the
   * plain selects below cannot widen access. Progress lives in welcome_lesson_progress until enrollment.
   */
  private async getWelcomeCourses(userId: string): Promise<LearningCourse[]> {
    const [lessons, progress] = await Promise.all([
      this.client
        .from("lessons")
        .select("id, module_id, position, slug, title, estimated_minutes")
        .eq("welcome", true)
        .eq("publication_status", "PUBLISHED")
        .order("position")
        .order("id"),
      this.client
        .from("welcome_lesson_progress")
        .select(
          "lesson_id, user_id, status, completion_percent, last_position_seconds, started_at, last_accessed_at, completed_at, updated_at",
        )
        .eq("user_id", userId),
    ]);
    if (lessons.error || progress.error) throw new Error("Unable to load welcome lessons.");
    const lessonRows = lessons.data ?? [];
    if (lessonRows.length === 0) return [];
    const moduleIds = [...new Set(lessonRows.map((row) => String(row.module_id)))];
    const { data: moduleRows, error: moduleError } = await this.client
      .from("modules")
      .select("id, course_id, position, title, description")
      .in("id", moduleIds)
      .eq("publication_status", "PUBLISHED")
      .order("position")
      .order("id");
    if (moduleError) throw new Error("Unable to load welcome modules.");
    const courseIds = [...new Set((moduleRows ?? []).map((row) => String(row.course_id)))];
    const { data: courseRows, error: courseError } = await this.client
      .from("courses")
      .select("id, slug, title, description")
      .in("id", courseIds)
      .order("slug")
      .order("id");
    if (courseError) throw new Error("Unable to load welcome courses.");
    const progressByLesson = new Map(
      (progress.data ?? []).map((row) => [
        String(row.lesson_id),
        progressFromRow({ ...row, id: row.lesson_id, enrollment_id: "welcome" }),
      ]),
    );
    const lessonsByModule = new Map<string, LearningLesson[]>();
    for (const row of lessonRows) {
      const moduleId = String(row.module_id);
      const list = lessonsByModule.get(moduleId) ?? [];
      list.push({
        id: String(row.id),
        moduleId,
        position: Number(row.position),
        slug: String(row.slug),
        title: String(row.title),
        estimatedMinutes:
          row.estimated_minutes === null || row.estimated_minutes === undefined
            ? null
            : Number(row.estimated_minutes),
        progress: progressByLesson.get(String(row.id)) ?? null,
      });
      lessonsByModule.set(moduleId, list);
    }
    return (courseRows ?? []).map((course) => ({
      id: String(course.id),
      slug: String(course.slug),
      title: String(course.title),
      description: course.description ? String(course.description) : null,
      welcome: true,
      completedAt: null,
      modules: (moduleRows ?? [])
        .filter((row) => String(row.course_id) === String(course.id))
        .map((row) => ({
          id: String(row.id),
          courseId: String(row.course_id),
          position: Number(row.position),
          title: String(row.title),
          description: row.description ? String(row.description) : null,
          lessons: (lessonsByModule.get(String(row.id)) ?? []).sort(
            (a, b) => a.position - b.position,
          ),
        })),
    }));
  }

  async getLessonContentForStudent(
    _userId: string,
    lessonId: string,
  ): Promise<LessonTextContent | null> {
    const { data, error } = await this.client
      .from("lesson_assets")
      .select("content")
      .eq("lesson_id", lessonId)
      .eq("asset_type", "TEXT")
      .eq("publication_status", "PUBLISHED")
      .order("position")
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Unable to load lesson content.");
    return parseLessonContent(data?.content);
  }

  async getProgressForStudent(
    userId: string,
    lessonId: string,
  ): Promise<LessonProgressSnapshot | null> {
    const { data, error } = await this.client
      .from("lesson_progress")
      .select(
        "id, enrollment_id, lesson_id, user_id, status, completion_percent, last_position_seconds, started_at, last_accessed_at, completed_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error) throw new Error("Unable to load lesson progress.");
    if (data) return progressFromRow(data);
    const welcome = await this.client
      .from("welcome_lesson_progress")
      .select(
        "lesson_id, user_id, status, completion_percent, last_position_seconds, started_at, last_accessed_at, completed_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (welcome.error) throw new Error("Unable to load lesson progress.");
    return welcome.data
      ? progressFromRow({ ...welcome.data, id: welcome.data.lesson_id, enrollment_id: "welcome" })
      : null;
  }

  async recordLessonProgress(input: LessonProgressInput): Promise<LessonProgressSnapshot> {
    const { data, error } = await this.client.rpc("record_lesson_progress", {
      p_lesson_id: input.lessonId,
      p_completion_percent: input.completionPercent,
      p_last_position_seconds: input.lastPositionSeconds ?? null,
    });

    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (isNoActiveCohortError(error)) throw new NoActiveCohortError();
    if (error?.code === "42501" && /enrollment/i.test(error.message)) {
      // No enrollment yet: a welcome lesson keeps its progress in the pre-enrollment table.
      return this.recordWelcomeProgress(input);
    }
    if (error || !data) throw new Error("Unable to persist lesson progress.");

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Lesson progress RPC returned no row.");

    return progressFromRow(row as Record<string, unknown>);
  }

  private async recordWelcomeProgress(input: LessonProgressInput): Promise<LessonProgressSnapshot> {
    const { data, error } = await this.client.rpc("record_welcome_lesson_progress", {
      p_lesson_id: input.lessonId,
      p_completion_percent: input.completionPercent,
      p_last_position_seconds: input.lastPositionSeconds ?? null,
    });
    if (error || !data) throw new Error("Unable to persist lesson progress.");
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    return progressFromRow({ ...row, id: row.lesson_id, enrollment_id: "welcome" });
  }
}
