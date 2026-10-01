import type { ReactNode } from "react";

import { AdminShell } from "@/modules/admin-content/ui/admin-shell";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageRole("ADMIN");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", auth.userId)
    .maybeSingle();
  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim()
      ? profile.display_name
      : auth.email?.split("@")[0] || "Admin Yas";
  return <AdminShell displayName={displayName}>{children}</AdminShell>;
}
