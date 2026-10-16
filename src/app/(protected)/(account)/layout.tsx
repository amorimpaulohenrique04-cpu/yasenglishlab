import type { ReactNode } from "react";

import { AdminShell } from "@/modules/admin-content/ui/admin-shell";
import { StudentShell } from "@/modules/learning/ui/student-shell";
import { TeacherShell } from "@/modules/teacher-operations/ui/teacher-shell";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

// Shared account pages (profile, support) keep the navigation of the user's main role.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageAuth();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", auth.userId)
    .maybeSingle();
  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
      ? profile.display_name
      : auth.email?.split("@")[0] || "Yas";
  const verifiedSession = auth.aal === "aal2";

  if (auth.roles.includes("ADMIN")) {
    return (
      <AdminShell displayName={displayName} verifiedSession={verifiedSession}>
        {children}
      </AdminShell>
    );
  }
  if (auth.roles.includes("TEACHER")) {
    return (
      <TeacherShell displayName={displayName} verifiedSession={verifiedSession}>
        {children}
      </TeacherShell>
    );
  }
  if (auth.roles.includes("STUDENT")) {
    return <StudentShell displayName={displayName}>{children}</StudentShell>;
  }
  return <main className="yas-profile-shell">{children}</main>;
}
