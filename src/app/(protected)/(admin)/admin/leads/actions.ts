"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crmLeadCreateSchema } from "@/modules/crm";
import { mutateAdminLead } from "@/server/crm/crm";

export async function crmAction(form: FormData): Promise<never> {
  const operation = String(form.get("operation") ?? "");
  const id = String(form.get("leadId") ?? "");
  const value = (name: string) => String(form.get(name) ?? "");
  let input: Record<string, unknown> = {};
  if (operation === "CREATE") {
    const parsed = crmLeadCreateSchema.safeParse({
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      source: value("source"),
      temperature: value("temperature"),
      estimated_value: value("estimated_value"),
    });
    if (!parsed.success) redirect("/admin/leads?result=invalid");
    input = { ...parsed.data, estimated_value: String(parsed.data.estimated_value ?? "") };
  } else if (operation === "UPDATE") {
    input = {
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      source: value("source"),
      temperature: value("temperature"),
      estimated_value: value("estimated_value"),
      owner_user_id: value("owner_user_id"),
    };
  } else if (operation === "STAGE") input = { stage: value("stage") };
  else if (operation === "INTERACTION") input = { type: value("type"), summary: value("summary") };
  else if (operation === "TASK")
    input = {
      title: value("title"),
      due_at: value("due_at"),
      owner_user_id: value("owner_user_id"),
    };
  else if (operation === "LINK_USER") input = { user_id: value("user_id") };
  else if (operation === "COMPLETE_TASK") input = {};
  else redirect("/admin/leads?result=invalid");
  try {
    await mutateAdminLead(
      operation,
      operation === "CREATE" ? null : operation === "COMPLETE_TASK" ? value("taskId") : id,
      input,
    );
  } catch {
    redirect("/admin/leads?result=error");
  }
  revalidatePath("/admin/leads");
  redirect("/admin/leads?result=saved");
}
