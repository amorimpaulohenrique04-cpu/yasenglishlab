import "server-only";

import {
  getLearningCourses,
  getLearningHome,
  getLessonView,
  getModuleView,
  markLessonStarted,
  recordLessonProgress,
  type LessonProgressInput,
} from "@/modules/learning";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole, requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseLearningRepository } from "./supabase-learning-repository";

async function context() {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();
  return {
    auth,
    repository: new SupabaseLearningRepository(client),
    analytics: new SupabaseProductAnalytics(client),
  };
}

export async function loadLearningHome() {
  const { auth, repository } = await context();
  return getLearningHome(repository, auth.userId, auth.roles.includes("STUDENT"));
}

export async function loadLearningCourses() {
  const { auth, repository } = await context();
  return getLearningCourses(repository, auth.userId, auth.roles.includes("STUDENT"));
}

export async function loadLearningModule(courseSlug: string, moduleId: string) {
  const { auth, repository } = await context();
  return getModuleView(
    repository,
    auth.userId,
    auth.roles.includes("STUDENT"),
    courseSlug,
    moduleId,
  );
}

export async function loadLearningLesson(courseSlug: string, moduleId: string, lessonSlug: string) {
  const { auth, repository } = await context();
  return getLessonView(
    repository,
    auth.userId,
    auth.roles.includes("STUDENT"),
    courseSlug,
    moduleId,
    lessonSlug,
  );
}

export async function recordCurrentStudentLessonProgress(input: LessonProgressInput) {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const repository = new SupabaseLearningRepository(client);
  const analytics = new SupabaseProductAnalytics(client);

  return recordLessonProgress(repository, analytics, auth.userId, input);
}

export async function trackCurrentStudentLessonStarted(lessonId: string): Promise<void> {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const analytics = new SupabaseProductAnalytics(client);
  await markLessonStarted(analytics, lessonId);
}
