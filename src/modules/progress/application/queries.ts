import {
  buildAssessmentView,
  buildAttendanceView,
  buildConsistency,
  buildCurriculumView,
  buildHistory,
  buildPracticeView,
} from "../domain/projection";
import type {
  ProgressAssessmentFact,
  ProgressAttendanceFact,
  ProgressPageState,
  ProgressPracticeFact,
  ProgressSection,
  ProgressViewData,
} from "../domain/models";
import type { ProgressRepository } from "./ports";
import type { LearningCourse } from "@/modules/learning";

const CEFR_UNAVAILABLE = {
  status: "unavailable",
  level: null,
  message:
    "O nível CEFR depende de uma avaliação validamente interpretada. A política de standard setting ainda não foi definida.",
} as const;

function sectionError<T>(label: string): ProgressSection<T> {
  return { status: "error", message: `Não foi possível carregar ${label} agora.` };
}

function section<T>(data: T, empty: boolean): ProgressSection<T> {
  return empty ? { status: "empty", data } : { status: "success", data };
}

export async function getProgressView(
  repository: ProgressRepository,
  userId: string,
  isStudent: boolean,
  now = new Date(),
): Promise<ProgressPageState> {
  if (!isStudent) return { status: "unauthorized" };

  const settled = await Promise.allSettled([
    repository.loadCurriculum(userId),
    repository.loadPractice(userId),
    repository.loadAttendance(userId),
    repository.loadAssessments(userId),
  ] as const);

  const domainNames = ["curriculum", "practice", "attendance", "assessment"] as const;
  const unavailableDomains = settled.flatMap((result, index) =>
    result.status === "rejected" ? [domainNames[index]!] : [],
  );

  if (unavailableDomains.length === settled.length) {
    return { status: "error", unavailableDomains };
  }

  const courses: LearningCourse[] = settled[0].status === "fulfilled" ? settled[0].value : [];
  const practice: ProgressPracticeFact[] =
    settled[1].status === "fulfilled" ? settled[1].value : [];
  const attendance: ProgressAttendanceFact[] =
    settled[2].status === "fulfilled" ? settled[2].value : [];
  const assessments: ProgressAssessmentFact[] =
    settled[3].status === "fulfilled" ? settled[3].value : [];

  const curriculumView = buildCurriculumView(courses);
  const practiceView = buildPracticeView(practice, now);
  const attendanceView = buildAttendanceView(attendance);
  const assessmentView = buildAssessmentView(assessments);
  const history = buildHistory({ courses, practice, attendance, assessments });

  const data: ProgressViewData = {
    curriculum:
      settled[0].status === "fulfilled"
        ? section(curriculumView, courses.length === 0)
        : sectionError("o progresso curricular"),
    practice:
      settled[1].status === "fulfilled"
        ? section(practiceView, practice.length === 0)
        : sectionError("as práticas"),
    attendance:
      settled[2].status === "fulfilled"
        ? section(attendanceView, attendance.length === 0)
        : sectionError("a participação nos encontros"),
    assessment:
      settled[3].status === "fulfilled"
        ? section(assessmentView, assessments.length === 0)
        : sectionError("as avaliações"),
    cefr: CEFR_UNAVAILABLE,
    consistency: buildConsistency(history, attendance, now),
    history,
  };

  if (unavailableDomains.length > 0) {
    return { status: "partial", data, unavailableDomains };
  }

  if (
    courses.length === 0 &&
    practice.length === 0 &&
    attendance.length === 0 &&
    assessments.length === 0
  ) {
    return { status: "empty" };
  }

  return { status: "success", data };
}
