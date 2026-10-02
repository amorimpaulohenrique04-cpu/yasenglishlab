import { redirect } from "next/navigation";
import { requirePageRole } from "@/server/auth/guards";

export default async function AdminPage() {
  await requirePageRole("ADMIN");
  redirect("/admin/content");
}
