"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cohortCommandSchema } from "@/modules/cohorts";
import { manageCurrentAdminCohort } from "@/server/cohorts/cohorts";

export async function manageCohortAction(form: FormData) {
  const operation = String(form.get("operation"));
  const input =
    operation === "CREATE"
      ? {
          course_id: form.get("course_id"),
          name: form.get("name"),
          code: form.get("code"),
          starts_at: form.get("starts_at"),
          ends_at: form.get("ends_at") || null,
          timezone: form.get("timezone") || "America/Recife",
        }
      : operation === "EDIT"
        ? { name: form.get("name") }
        : operation === "STATUS"
          ? { status: form.get("status") }
          : operation.endsWith("STUDENT")
            ? { user_id: form.get("user_id") }
            : { teacher_id: form.get("teacher_id"), is_primary: form.get("is_primary") === "on" };
  const parsed = cohortCommandSchema.safeParse({
    operation,
    cohortId: form.get("cohortId") || null,
    input,
  });
  if (!parsed.success) redirect("/admin/cohorts?result=invalid");
  try {
    await manageCurrentAdminCohort(parsed.data);
  } catch {
    redirect("/admin/cohorts?result=error");
  }
  revalidatePath("/admin/cohorts");
  revalidatePath("/agenda");
  revalidatePath("/teacher");
  redirect("/admin/cohorts?result=success");
}
