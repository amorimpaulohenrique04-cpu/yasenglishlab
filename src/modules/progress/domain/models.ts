import type { AssessmentSkill } from "@/modules/assessments";
import type { PracticeSkill } from "@/modules/domain";

export type ProgressPracticeStatus = "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
export type ProgressPracticeEvaluationStatus =
  | "CORRECT"
  | "INCORRECT"
  | "PENDING_MANUAL"
  | "NOT_SCORED"
  | null;

export interface ProgressPracticeFact {
  attemptId: string;
  activityId: string;
  activityTitle: string;
  skill: PracticeSkill;
  estimatedMinutes: number;
  status: ProgressPracticeStatus;
  startedAt: string;
  submittedAt: string | null;
  evaluationStatus: ProgressPracticeEvaluationStatus;
  score: number | null;
  maxScore: number | null;
}

export type ProgressBookingStatus = "BOOKED" | "CANCELLED" | "TEACHER_CANCELLED";
export type ProgressAttendanceStatus = "ATTENDED" | "NO_SHOW" | null;
export type ProgressSessionType =
  | "CORE_CLASS"
  | "CONVERSATION_LAB"
  | "PRIVATE_SESSION"
  | "WORKSHOP";

export interface ProgressAttendanceFact {
  bookingId: string;
  liveSessionId: string;
  title: string;
  sessionType: ProgressSessionType;
  startsAt: string;
  bookingStatus: ProgressBookingStatus;
  bookedAt: string;
  cancelledAt: string | null;
  attendanceStatus: ProgressAttendanceStatus;
  attendanceMarkedAt: string | null;
}

export interface ProgressAssessmentSkillFact {
  skill: AssessmentSkill;
  score: number;
  maxScore: number | null;
  createdAt: string;
}

export type ProgressAssessmentStatus = "IN_PROGRESS" | "SUBMITTED" | "SCORED" | "INVALIDATED";

export interface ProgressAssessmentFact {
  attemptId: string;
  status: ProgressAssessmentStatus;
  startedAt: string;
  submittedAt: string | null;
  scoredAt: string | null;
  rawScore: number | null;
  skillScores: ProgressAssessmentSkillFact[];
}

export interface ProgressCurriculumCourse {
  id: string;
  slug: string;
  title: string;
  completionPercent: number;
  lessonsCompleted: number;
  totalLessons: number;
  modulesCompleted: number;
  totalModules: number;
  lastActivityAt: string | null;
}

export interface ProgressCurriculumView {
  courses: ProgressCurriculumCourse[];
}

export interface ProgressPracticeView {
  recent: ProgressPracticeFact[];
  completedLast7Days: number;
  minutesLast7Days: number;
}

export interface ProgressAttendanceView {
  recent: ProgressAttendanceFact[];
  attended: number;
  noShow: number;
  pending: number;
  cancelled: number;
  attendanceRatePercent: number | null;
}

export interface ProgressSkillSummary {
  skill: AssessmentSkill;
  score: number | null;
  maxScore: number | null;
  attemptId: string | null;
  recordedAt: string | null;
}

export interface ProgressAssessmentView {
  recent: ProgressAssessmentFact[];
  skills: ProgressSkillSummary[];
}

export interface ProgressCefrView {
  status: "unavailable";
  level: null;
  message: string;
}

export type ProgressHistoryKind =
  | "lesson_completed"
  | "practice_submitted"
  | "attendance_marked"
  | "assessment_submitted"
  | "assessment_scored";

export interface ProgressHistoryEvent {
  id: string;
  kind: ProgressHistoryKind;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface ProgressConsistencyView {
  activeDaysLast7Days: number;
  lessonsCompletedLast7Days: number;
  practicesCompletedLast7Days: number;
  attendedLast7Days: number;
}

export type ProgressSection<T> =
  | { status: "success"; data: T }
  | { status: "empty"; data: T }
  | { status: "error"; message: string };

export interface ProgressViewData {
  curriculum: ProgressSection<ProgressCurriculumView>;
  practice: ProgressSection<ProgressPracticeView>;
  attendance: ProgressSection<ProgressAttendanceView>;
  assessment: ProgressSection<ProgressAssessmentView>;
  cefr: ProgressCefrView;
  consistency: ProgressConsistencyView;
  history: ProgressHistoryEvent[];
}

export type ProgressPageState =
  | { status: "unauthorized" }
  | { status: "empty" }
  | { status: "success"; data: ProgressViewData }
  | { status: "partial"; data: ProgressViewData; unavailableDomains: string[] }
  | { status: "error"; unavailableDomains: string[] };
