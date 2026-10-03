"use server";
import { createLessonVideoUpload } from "@/server/media/lesson-video";
export async function createVideoUploadAction(id: string, language: string) {
  return createLessonVideoUpload(id, language);
}
