import { z } from "zod";

import { TEACHER_ATTENDANCE_STATUSES } from "../domain/models";
import type { TeacherOperationsRepository } from "./ports";

export const markTeacherAttendanceInputSchema = z
  .object({
    sessionBookingId: z.string().uuid(),
    status: z.enum(TEACHER_ATTENDANCE_STATUSES),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export type MarkTeacherAttendanceInput = z.infer<typeof markTeacherAttendanceInputSchema>;

export async function markTeacherAttendance(
  repository: TeacherOperationsRepository,
  rawInput: MarkTeacherAttendanceInput,
) {
  const input = markTeacherAttendanceInputSchema.parse(rawInput);
  return repository.markAttendance(input.sessionBookingId, input.status, input.reason);
}
