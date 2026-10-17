"use server";

import { revalidatePath } from "next/cache";

import { assertRole } from "@/server/auth/guards";

import { updateSupportTicket } from "@/server/operations/operations";

export async function updateTicketAction(form: FormData) {
  await assertRole("ADMIN");
  await updateSupportTicket({
    id: form.get("ticketId"),
    status: form.get("status"),
    note: form.get("note"),
  });
  revalidatePath("/admin/suporte");
}
