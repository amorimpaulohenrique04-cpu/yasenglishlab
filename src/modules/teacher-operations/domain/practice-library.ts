import type { PRACTICE_SKILLS } from "@/modules/domain";
type PracticeSkill = (typeof PRACTICE_SKILLS)[number];

/** Client-safe read model. No server module or private answer key crosses this boundary. */
export interface PracticeLibraryItem {
  id: string;
  title: string;
  skill: PracticeSkill;
  estimatedMinutes: number;
  cefrTarget: string | null;
  courseId: string | null;
  courseTitle: string | null;
  publicationStatus: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  responseType: string | null;
  stimulusType: string | null;
  hasAttempts: boolean;
  assignmentCount: number;
  updatedAt: string;
  objective: string;
  difficulty: string | null;
  itemCount: number;
  moduleTitle: string | null;
  lessonTitle: string | null;
  relatedLessonId: string | null;
}
