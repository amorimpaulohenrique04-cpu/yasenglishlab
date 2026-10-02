"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
export async function saveAvailabilityAction(form: FormData) {
  await assertRole("TEACHER");
  const operation = z.enum(["CREATE", "EDIT", "DELETE"]).parse(form.get("operation"));
  const id = form.get("id") ? z.uuid().parse(form.get("id")) : null;
  const client = await createSupabaseServerClient();
  let rejected = false;
  try {
    const { error } = await client.rpc("manage_teacher_availability", {
      p_operation: operation,
      p_id: id,
      p_starts_at:
        operation === "DELETE" ? null : new Date(String(form.get("starts_at"))).toISOString(),
      p_ends_at:
        operation === "DELETE" ? null : new Date(String(form.get("ends_at"))).toISOString(),
    });
    rejected = Boolean(error);
  } catch {
    rejected = true;
  }
  revalidatePath("/teacher/disponibilidade");
  redirect(`/teacher/disponibilidade?save=${rejected ? "error" : "success"}`);
}
