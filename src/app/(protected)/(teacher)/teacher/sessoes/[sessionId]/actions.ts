"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  TeacherOperationsError,
  markTeacherAttendanceInputSchema,
} from "@/modules/teacher-operations";
import { markCurrentTeacherAttendance } from "@/server/teacher-operations/teacher-operations";

const sessionIdSchema = z.string().uuid();

export async function markAttendanceAction(formData: FormData): Promise<void> {
  const sessionId = sessionIdSchema.parse(formData.get("sessionId"));
  const input = markTeacherAttendanceInputSchema.parse({
    sessionBookingId: formData.get("sessionBookingId"),
    status: formData.get("status"),
  });

  try {
    await markCurrentTeacherAttendance(input);
  } catch (error) {
    if (error instanceof TeacherOperationsError) {
      redirect("/teacher/sessoes/" + sessionId + "?attendance=error");
    }
    throw error;
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/sessoes/" + sessionId);
  redirect("/teacher/sessoes/" + sessionId + "?attendance=success");
}
