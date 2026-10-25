import "server-only";
import {
  capTeacherSearchIndex,
  type TeacherSearchIndex,
} from "@/modules/teacher-operations/domain/search-index";
import { entryDetailUrl, entryFiltersSchema } from "@/modules/placement/domain/entry-workspace";
import { studentFiltersSchema } from "@/modules/teacher-operations/domain/student-workspace";
import { loadEntryQueue } from "@/server/placement/entry-workspace";
import { loadReviewQueuePage } from "@/server/teacher-operations/pedagogy";
import { loadStudentsWorkspace } from "@/server/teacher-operations/student-workspace";

async function settle<T>(label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    // Degrade: the palette still works with the remaining sources.
    console.error(`teacher search index: ${label} unavailable`, error);
    return null;
  }
}

/**
 * Palette entities from existing teacher-scoped reads (user session client, RLS/RPC scoped).
 * The reads run in parallel; any failure only drops its own section.
 */
export async function loadTeacherSearchIndex(): Promise<TeacherSearchIndex> {
  const entryFilters = entryFiltersSchema.parse({});
  const [workspace, entries, practices] = await Promise.all([
    settle("students", () => loadStudentsWorkspace(studentFiltersSchema.parse({}))),
    settle("entry", () => loadEntryQueue(entryFilters)),
    // One page of the paginated queue (oldest first); the index is capped anyway.
    settle("practice", () =>
      loadReviewQueuePage({ tab: "all", q: "", cohort: "", order: "oldest", limit: 50 }),
    ),
  ]);
  const students = (workspace?.items ?? []).map((student) => ({
    id: student.id,
    name: student.name,
    cohortNames: [
      ...new Set(
        student.enrollments.flatMap((enrollment) => enrollment.cohorts.map((c) => c.name)),
      ),
    ],
    href: `/teacher/alunos/${student.id}`,
  }));
  // There is no per-cohort route; every cohort links to the cohorts overview.
  const cohorts = (workspace?.cohorts ?? []).map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    href: "/teacher/turmas",
  }));
  const reviews = [
    ...(entries?.items ?? [])
      .filter((item) => item.status !== "done")
      .map((item) => ({
        id: item.id,
        title: `Entrada · ${item.name}`,
        kind: "entry" as const,
        href: entryDetailUrl(item.id, entryFilters),
      })),
    ...(practices?.entries ?? []).map((entry) => ({
      id: entry.id,
      title: `${entry.title} · ${entry.studentName ?? "Aluno"}`,
      kind: "practice" as const,
      href: `/teacher/revisoes/${entry.id}`,
    })),
  ];
  return capTeacherSearchIndex({ students, cohorts, reviews });
}
