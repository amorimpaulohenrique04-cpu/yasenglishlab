"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { openSupportTicket } from "@/server/operations/operations";

export async function openTicketAction(form: FormData) {
  let result = "sent";
  try {
    await openSupportTicket({
      category: form.get("category"),
      subject: form.get("subject"),
      body: form.get("body"),
    });
  } catch (error) {
    result = error instanceof Error && error.message === "TOO_MANY_TICKETS" ? "limit" : "error";
  }
  revalidatePath("/support");
  redirect(`/support?ticket=${result}`);
}
