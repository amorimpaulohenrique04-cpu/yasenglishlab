import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  LearningCourse,
  LearningLesson,
  LearningModule,
  LearningRepository,
  LessonProgressInput,
  LessonProgressSnapshot,
  LessonTextContent,
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

  async getActiveCoursesForStudent(userId: string): Promise<LearningCourse[]> {
    const { data: enrollmentRows, error: enrollmentError } = await this.client
      .from("enrollments")
      .select("id, course_id")
      .eq("user_id", userId)
      .eq("status", "ACTIVE");

    if (enrollmentError) throw new Error("Unable to load enrollments.");
    if (!enrollmentRows || enrollmentRows.length === 0) return [];

    const courseIds = enrollmentRows.map((row) => String(row.course_id));

    const [{ data: courseRows, error: courseError }, { data: moduleRows, error: moduleError }] =
      await Promise.all([
        this.client
          .from("courses")
          .select("id, slug, title, description")
          .in("id", courseIds)
          .eq("active", true)
          .order("slug")
          .order("id"),
        this.client
          .from("modules")
          .select("id, course_id, position, title, description")
          .in("course_id", courseIds)
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

    const lessonsByModule = new Map<string, LearningLesson[]>();
    for (const row of lessonRows) {
      const moduleId = String(row.module_id);
      const lesson: LearningLesson = {
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
        lessons: (lessonsByModule.get(String(row.id)) ?? []).sort(
          (a, b) => a.position - b.position,
        ),
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
    return data ? progressFromRow(data) : null;
  }

  async recordLessonProgress(input: LessonProgressInput): Promise<LessonProgressSnapshot> {
    const { data, error } = await this.client.rpc("record_lesson_progress", {
      p_lesson_id: input.lessonId,
      p_completion_percent: input.completionPercent,
      p_last_position_seconds: input.lastPositionSeconds ?? null,
    });

    if (error || !data) throw new Error("Unable to persist lesson progress.");

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Lesson progress RPC returned no row.");

    return progressFromRow(row as Record<string, unknown>);
  }
}
