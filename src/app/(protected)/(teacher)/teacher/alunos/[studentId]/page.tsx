import { notFound } from "next/navigation";
import { z } from "zod";
import { parseProfileFilters } from "@/modules/teacher-operations/domain/student-workspace";
import { StudentProfile } from "@/modules/teacher-operations/ui/student-profile";
import { loadStudentWorkspace } from "@/server/teacher-operations/student-workspace";
import { studentCommandAction } from "../workspace-actions";

export default async function TeacherStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const id = z.uuid().safeParse(route.studentId);
  if (!id.success) notFound();
  const filters = parseProfileFilters(query);
  const data = await loadStudentWorkspace(id.data, filters);
  if (!data) notFound();
  return (
    <StudentProfile
      key={id.data}
      data={data}
      filters={filters}
      commandAction={studentCommandAction}
    />
  );
}
