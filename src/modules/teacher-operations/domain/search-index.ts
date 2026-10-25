/** Entities the teacher can jump to from the Ctrl/Cmd K palette (already RLS-scoped server side). */
export interface TeacherSearchIndex {
  students: { id: string; name: string; cohortNames: string[]; href: string }[];
  cohorts: { id: string; name: string; href: string }[];
  reviews: { id: string; title: string; kind: "entry" | "practice"; href: string }[];
}

export const emptyTeacherSearchIndex: TeacherSearchIndex = {
  students: [],
  cohorts: [],
  reviews: [],
};

export const TEACHER_SEARCH_CAP = 200;

/** Caps the whole index at `cap` rows, reserving a share for cohorts and reviews. */
export function capTeacherSearchIndex(
  index: TeacherSearchIndex,
  cap = TEACHER_SEARCH_CAP,
): TeacherSearchIndex {
  const cohorts = index.cohorts.slice(0, Math.floor(cap / 4));
  const reviews = index.reviews.slice(0, Math.floor(cap / 4));
  const students = index.students.slice(0, Math.max(0, cap - cohorts.length - reviews.length));
  return { students, cohorts, reviews };
}
