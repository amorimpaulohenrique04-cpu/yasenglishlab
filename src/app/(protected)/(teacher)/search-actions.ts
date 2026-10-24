"use server";
import { assertRole } from "@/server/auth/guards";
import type { TeacherSearchIndex } from "@/modules/teacher-operations/domain/search-index";
import { loadTeacherSearchIndex } from "@/server/teacher-operations/search-index";

/** Lazy palette index; called on the first palette open instead of every layout render. */
export async function loadTeacherSearchIndexAction(): Promise<TeacherSearchIndex> {
  await assertRole("TEACHER");
  return loadTeacherSearchIndex();
}
