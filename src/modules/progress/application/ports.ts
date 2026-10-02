import type { LearningCourse } from "@/modules/learning";

import type {
  ProgressAssessmentFact,
  ProgressAttendanceFact,
  ProgressPracticeFact,
} from "../domain/models";

export interface ProgressRepository {
  loadCurriculum(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<ProgressPracticeFact[]>;
  loadAttendance(userId: string): Promise<ProgressAttendanceFact[]>;
  loadAssessments(userId: string): Promise<ProgressAssessmentFact[]>;
}
