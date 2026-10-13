"use server";

import { assertRole } from "@/server/auth/guards";
import { createLessonVideoUpload } from "@/server/media/lesson-video";
export async function createVideoUploadAction(id: string, language: string) {
  await assertRole("ADMIN");
  return createLessonVideoUpload(id, language);
}
