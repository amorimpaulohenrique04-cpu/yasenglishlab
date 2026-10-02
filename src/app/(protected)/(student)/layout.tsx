import type { ReactNode } from "react";

import { StudentShell } from "@/modules/learning/ui/student-shell";
import { getStudentRequestContext } from "@/server/student/request-context";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const { auth, supabase } = await getStudentRequestContext();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
      ? profile.display_name
      : auth.email?.split("@")[0] || "Aluno Yas";

  return <StudentShell displayName={displayName}>{children}</StudentShell>;
}
