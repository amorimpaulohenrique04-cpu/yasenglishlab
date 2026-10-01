import type { ReactNode } from "react";

import { TeacherShell } from "@/modules/teacher-operations/ui/teacher-shell";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageRole("TEACHER");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
      ? profile.display_name
      : auth.email?.split("@")[0] || "Professor Yas";

  return <TeacherShell displayName={displayName}>{children}</TeacherShell>;
}
