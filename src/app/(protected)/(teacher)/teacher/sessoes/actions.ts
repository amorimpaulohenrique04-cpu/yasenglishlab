"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { saveCurrentTeacherSession } from "@/server/teacher-operations/session-commands";
import { getLiveSessionJoinAccess } from "@/server/schedule/meeting-access";

export async function saveSessionAction(form: FormData) {
  const id = String(form.get("id") || "") || null;
  const target = id ? `/teacher/sessoes/${z.uuid().parse(id)}` : "/teacher/sessoes/nova";
  let sessionId: string;
  try {
    sessionId = await saveCurrentTeacherSession(id, {
      title: form.get("title"),
      session_type: form.get("session_type"),
      starts_at: new Date(String(form.get("starts_at"))).toISOString(),
      ends_at: new Date(String(form.get("ends_at"))).toISOString(),
      capacity: form.get("capacity"),
      cohort_id: form.get("cohort_id") || null,
      target_student_user_id: form.get("target_student_user_id") || null,
      ...(form.get("meeting_url") ? { meeting_url: form.get("meeting_url") } : {}),
    });
  } catch {
    redirect(target + "?save=error");
  }
  revalidatePath("/teacher");
  revalidatePath("/agenda");
  redirect(`/teacher/sessoes/${sessionId}?save=success`);
}
export async function cancelTeacherSessionAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("sessionId"));
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("cancel_teacher_live_session", { p_live_session_id: id });
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    const notCancellable =
      message.includes("only scheduled sessions can be cancelled") ||
      message.includes("recorded attendance cannot be cancelled");
    redirect(`/teacher/sessoes/${id}?save=${notCancellable ? "not_cancellable" : "error"}`);
  }
  revalidatePath("/teacher");
  revalidatePath("/agenda");
  revalidatePath("/home");
  redirect(`/teacher/sessoes/${id}?save=success`);
}
export async function teacherJoinAction(id: string) {
  await assertRole("TEACHER");
  return getLiveSessionJoinAccess(id);
}
