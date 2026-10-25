import { parseStudentFilters } from "@/modules/teacher-operations/domain/student-workspace";
import { StudentsWorkspace } from "@/modules/teacher-operations/ui/students-workspace";
import { loadStudentsWorkspace } from "@/server/teacher-operations/student-workspace";
import { studentEventsAction } from "./workspace-actions";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseStudentFilters(await searchParams);
  const data = await loadStudentsWorkspace(filters);
  return <StudentsWorkspace data={data} filters={filters} eventsAction={studentEventsAction} />;
}
