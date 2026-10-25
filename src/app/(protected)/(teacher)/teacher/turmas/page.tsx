import { CohortsWorkspace } from "@/modules/teacher-operations/ui/cohorts-workspace";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";

export default async function TeacherCohortsPage() {
  const { cohorts } = await loadTeacherOperationContext();
  return <CohortsWorkspace cohorts={cohorts} />;
}
