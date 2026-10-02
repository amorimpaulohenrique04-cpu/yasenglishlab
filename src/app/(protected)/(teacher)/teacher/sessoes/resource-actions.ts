"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { manualMeetingUrlSchema } from "@/modules/teacher-operations/domain/session-input";
import {
  getSessionResourceAccess,
  requestSessionResourceUpload,
} from "@/server/teacher-operations/resources";
export async function sessionResourceAccessAction(id: string) {
  return getSessionResourceAccess(id);
}
export async function resourceUploadAction(id: string, title: string) {
  return requestSessionResourceUpload(id, title);
}
export async function completeResourceUploadAction(id: string) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("complete_session_resource_file", {
    p_resource: z.uuid().parse(id),
  });
  if (error) throw new Error("Arquivo inválido.");
  revalidatePath("/teacher");
  revalidatePath("/agenda");
}
export async function createResourceAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("sessionId"));
  const client = await createSupabaseServerClient();
  const input = {
    resource_type: z.enum(["RESOURCE", "HOMEWORK"]).parse(form.get("resource_type")),
    title: z.string().trim().min(1).max(200).parse(form.get("title")),
    instructions: z
      .string()
      .max(4000)
      .parse(form.get("instructions") || ""),
    due_at: form.get("due_at") ? new Date(String(form.get("due_at"))).toISOString() : null,
    material_id: form.get("material_id") ? z.uuid().parse(form.get("material_id")) : null,
    practice_activity_id: form.get("practice_activity_id")
      ? z.uuid().parse(form.get("practice_activity_id"))
      : null,
    external_url: form.get("external_url")
      ? manualMeetingUrlSchema.parse(form.get("external_url"))
      : null,
  };
  const { error } = await client.rpc("create_session_resource", { p_session: id, p_input: input });
  revalidatePath("/agenda");
  revalidatePath(`/teacher/sessoes/${id}`);
  redirect(`/teacher/sessoes/${id}?save=${error ? "error" : "success"}`);
}
