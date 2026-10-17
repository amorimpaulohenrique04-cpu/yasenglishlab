import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const inboxPageSize = 20;

const rowSchema = z.object({
  id: z.uuid(),
  notification_type: z.string(),
  title: z.string(),
  body: z.string(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

/** In-app notifications of the signed-in Student, newest first. RLS limits the rows to their own. */
export async function loadStudentInbox(page: number) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * inboxPageSize;
  const { data, error, count } = await client
    .from("notifications")
    .select("id,notification_type,title,body,read_at,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + inboxPageSize - 1);
  if (error) throw new Error("Notifications unavailable.");
  const items: InboxNotification[] = z
    .array(rowSchema)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      type: row.notification_type,
      title: row.title,
      body: row.body,
      read: row.read_at !== null,
      createdAt: row.created_at,
    }));
  return { items, total: count ?? items.length, page: safePage, pageSize: inboxPageSize };
}

export async function markAllStudentNotificationsRead() {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("mark_notifications_read", { p_ids: null });
  if (error) throw new Error("Notifications unavailable.");
}

/** Where a notification leads. Unknown types stay informational. */
export function notificationHref(type: string): string | null {
  if (type === "PLACEMENT_READY") return "/home";
  if (type === "PRACTICE_FEEDBACK_READY") return "/feedbacks";
  if (type.includes("SESSION") || type.startsWith("BOOKING") || type.startsWith("MEETING"))
    return "/agenda";
  return null;
}
