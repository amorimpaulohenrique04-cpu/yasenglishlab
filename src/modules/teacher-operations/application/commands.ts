import { z } from "zod";

import { TEACHER_ATTENDANCE_STATUSES } from "../domain/models";
import type { TeacherOperationsRepository } from "./ports";

export const markTeacherAttendanceInputSchema = z
  .object({
    sessionBookingId: z.string().uuid(),
    status: z.enum(TEACHER_ATTENDANCE_STATUSES),
  })
  .strict();

export type MarkTeacherAttendanceInput = z.infer<typeof markTeacherAttendanceInputSchema>;

export async function markTeacherAttendance(
  repository: TeacherOperationsRepository,
  rawInput: MarkTeacherAttendanceInput,
) {
  const input = markTeacherAttendanceInputSchema.parse(rawInput);
  return repository.markAttendance(input.sessionBookingId, input.status);
}
