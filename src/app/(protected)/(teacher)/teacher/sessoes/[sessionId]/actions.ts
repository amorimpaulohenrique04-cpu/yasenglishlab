"use server";

import { assertRole } from "@/server/auth/guards";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  TeacherOperationsError,
  TEACHER_ATTENDANCE_ERROR_MESSAGES,
  markTeacherAttendanceInputSchema,
} from "@/modules/teacher-operations";
import { markCurrentTeacherAttendance } from "@/server/teacher-operations/teacher-operations";

const sessionIdSchema = z.string().uuid();

export async function markAttendanceResultAction(
  form: FormData,
): Promise<{ ok: boolean; message: string }> {
  await assertRole("TEACHER");
  const sessionId = sessionIdSchema.safeParse(form.get("sessionId"));
  const input = markTeacherAttendanceInputSchema.safeParse({
    sessionBookingId: form.get("sessionBookingId"),
    status: form.get("status"),
    reason: String(form.get("reason") ?? "").trim() || undefined,
  });
  if (!sessionId.success || !input.success)
    return {
      ok: false,
      message: "Confira a reserva, o status e o motivo da correção (3 a 500 caracteres).",
    };
  try {
    await markCurrentTeacherAttendance(input.data);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof TeacherOperationsError
          ? TEACHER_ATTENDANCE_ERROR_MESSAGES[error.code]
          : "Não foi possível atualizar a presença. Tente novamente.",
    };
  }
  revalidatePath("/teacher", "layout");
  revalidatePath(`/teacher/sessoes/${sessionId.data}`);
  return { ok: true, message: "Presença atualizada" };
}
