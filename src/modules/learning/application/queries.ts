import type { LearningRepository } from "./ports";
import type { LearningCourse, LearningModule, LearningState, LessonDetail } from "../domain/models";
import { courseCompletion, nextLesson } from "../domain/progress";

export interface LearningHomeView {
  course: LearningCourse;
  completionPercent: number;
  nextLesson: ReturnType<typeof nextLesson>;
  nextModule: LearningModule | null;
}

export async function getLearningHome(
  repository: LearningRepository,
  userId: string,
  isStudent: boolean,
): Promise<LearningState<LearningHomeView>> {
  if (!isStudent) return { status: "unauthorized" };

  const courses = await repository.getActiveCoursesForStudent(userId);
  const course = courses[0];
  if (!course) return { status: "empty" };

  const lesson = nextLesson(course);
  const nextModule =
    course.modules.find((module) =>
      module.lessons.some((candidate) => candidate.id === lesson?.id),
    ) ?? null;

  return {
    status: "success",
    data: {
      course,
      completionPercent: courseCompletion(course),
      nextLesson: lesson,
      nextModule,
    },
  };
}

export async function getLearningCourses(
  repository: LearningRepository,
  userId: string,
  isStudent: boolean,
): Promise<LearningState<LearningCourse[]>> {
  if (!isStudent) return { status: "unauthorized" };
  const courses = await repository.getActiveCoursesForStudent(userId);
  return courses.length > 0 ? { status: "success", data: courses } : { status: "empty" };
}

export async function getModuleView(
  repository: LearningRepository,
  userId: string,
  isStudent: boolean,
  courseSlug: string,
  moduleId: string,
): Promise<LearningState<{ course: LearningCourse; module: LearningModule }>> {
  if (!isStudent) return { status: "unauthorized" };

  const courses = await repository.getActiveCoursesForStudent(userId);
  const course = courses.find((candidate) => candidate.slug === courseSlug);
  const courseModule = course?.modules.find((candidate) => candidate.id === moduleId);

  if (!course || !courseModule) return { status: "unauthorized" };
  return { status: "success", data: { course, module: courseModule } };
}

export async function getLessonView(
  repository: LearningRepository,
  userId: string,
  isStudent: boolean,
  courseSlug: string,
  moduleId: string,
  lessonSlug: string,
): Promise<LearningState<LessonDetail>> {
  if (!isStudent) return { status: "unauthorized" };

  const courses = await repository.getActiveCoursesForStudent(userId);
  const course = courses.find((candidate) => candidate.slug === courseSlug);
  const courseModule = course?.modules.find((candidate) => candidate.id === moduleId);
  const lesson = courseModule?.lessons.find((candidate) => candidate.slug === lessonSlug);

  if (!course || !courseModule || !lesson) return { status: "unauthorized" };

  const content = await repository.getLessonContentForStudent(userId, lesson.id);
  return {
    status: "success",
    data: { course, module: courseModule, lesson, content },
  };
}
