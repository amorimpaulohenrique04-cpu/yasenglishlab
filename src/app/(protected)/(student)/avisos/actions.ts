"use server";

import { revalidatePath } from "next/cache";

import { markAllStudentNotificationsRead } from "@/server/notifications/student-inbox";

export async function markNoticesReadAction() {
  await markAllStudentNotificationsRead();
  revalidatePath("/avisos");
}
