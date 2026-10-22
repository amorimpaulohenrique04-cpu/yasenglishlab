import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { MotionProvider } from "@/components/motion";
import { ToastProvider } from "@/components/ui";
import {
  SessionCommandPalette,
  type PaletteSession,
} from "@/modules/teacher-operations/ui/session-command-palette";
import { loadSessionWorkspace } from "@/server/teacher-operations/session-workspace";

export default async function TeacherSessionsLayout({ children }: { children: ReactNode }) {
  // The palette is an enhancement: a failed load leaves the pages and their own errors intact.
  const sessions: PaletteSession[] = await loadSessionWorkspace()
    .then((workspace) =>
      workspace.sessions.map(
        ({ id, title, starts_at, session_type, status, cohort_name, participant_search }) => ({
          id,
          title,
          starts_at,
          session_type,
          status,
          cohort_name,
          participant_search,
        }),
      ),
    )
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return [];
    });
  return (
    <MotionProvider>
      <ToastProvider>
        {children}
        <SessionCommandPalette sessions={sessions} />
      </ToastProvider>
    </MotionProvider>
  );
}
