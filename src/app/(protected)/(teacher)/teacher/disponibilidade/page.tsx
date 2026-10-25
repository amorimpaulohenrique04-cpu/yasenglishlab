import { MotionProvider } from "@/components/motion";
import { ToastProvider } from "@/components/ui";
import {
  availabilityFilters,
  availabilityWeekStart,
} from "@/modules/teacher-operations/domain/availability-workspace";
import { localParts } from "@/modules/teacher-operations/domain/session-workspace";
import { AvailabilityWorkspace } from "@/modules/teacher-operations/ui/availability-workspace";
import { loadAvailabilityWorkspace } from "@/server/teacher-operations/availability-workspace";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import { mutateAvailabilityWorkspace } from "./workspace-actions";
export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = sessionWorkspaceNow();
  const today = localParts(new Date(now)).date;
  const filters = availabilityFilters(await searchParams, today);
  const week = availabilityWeekStart(filters.date);
  const data = await loadAvailabilityWorkspace(week);
  return (
    <MotionProvider>
      <ToastProvider>
        <AvailabilityWorkspace
          data={data}
          filters={filters}
          today={today}
          now={now}
          action={mutateAvailabilityWorkspace}
        />
      </ToastProvider>
    </MotionProvider>
  );
}
