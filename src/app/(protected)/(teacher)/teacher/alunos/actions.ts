"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
export async function createNoteAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("studentId"));
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("create_teacher_note", {
    p_student: id,
    p_body: z.string().trim().min(1).max(4000).parse(form.get("body")),
  });
  revalidatePath(`/teacher/alunos/${id}`);
  redirect(`/teacher/alunos/${id}?save=${error ? "error" : "success"}`);
}
