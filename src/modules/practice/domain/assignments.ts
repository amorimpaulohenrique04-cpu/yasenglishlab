import { z } from "zod";

import { practiceSkillSchema } from "@/modules/domain";

import type { PracticeRecommendationActivity } from "./models";

/** Row of `student_assigned_practices()` (no content, no answer key). */
export const assignedPracticeRowSchema = z.object({
  practice_activity_id: z.uuid(),
  cohort_id: z.uuid(),
  cohort_name: z.string(),
  title: z.string(),
  skill: practiceSkillSchema,
  estimated_minutes: z.number().int(),
  response_type: z.string().nullable(),
  assigned_at: z.string(),
  due_at: z.string().nullable(),
  status: z.enum(["NEW", "IN_PROGRESS", "OVERDUE", "DONE"]),
  attempt_id: z.uuid().nullable(),
});

export type AssignedPracticeStatus = z.infer<typeof assignedPracticeRowSchema>["status"];

export interface AssignedPractice {
  practiceActivityId: string;
  cohortId: string;
  cohortName: string;
  title: string;
  skill: z.infer<typeof practiceSkillSchema>;
  estimatedMinutes: number;
  responseType: string | null;
  assignedAt: string;
  dueAt: string | null;
  status: AssignedPracticeStatus;
  attemptId: string | null;
}

export function assignedPracticeFromRow(value: unknown): AssignedPractice {
  const row = assignedPracticeRowSchema.parse(value);
  return {
    practiceActivityId: row.practice_activity_id,
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    title: row.title,
    skill: row.skill,
    estimatedMinutes: row.estimated_minutes,
    responseType: row.response_type,
    assignedAt: row.assigned_at,
    dueAt: row.due_at,
    status: row.status,
    attemptId: row.attempt_id,
  };
}

export interface PracticeAssignmentRepository {
  listAssignedPractices(): Promise<AssignedPractice[]>;
}

/**
 * Copies the earliest pending deadline of each assigned practice onto the recommendation candidates so
 * `recommendPractice` can prioritise them. Finished assignments never add a deadline.
 */
export function withAssignmentDueDates(
  activities: readonly PracticeRecommendationActivity[],
  assignments: readonly AssignedPractice[],
): PracticeRecommendationActivity[] {
  const due = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.status === "DONE" || !assignment.dueAt) continue;
    const current = due.get(assignment.practiceActivityId);
    if (!current || Date.parse(assignment.dueAt) < Date.parse(current)) {
      due.set(assignment.practiceActivityId, assignment.dueAt);
    }
  }
  return activities.map((activity) => {
    const dueAt = due.get(activity.id);
    return dueAt ? { ...activity, dueAt } : activity;
  });
}
