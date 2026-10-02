"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { startPracticeInputSchema, submitPracticeInputSchema } from "@/modules/practice";
import {
  startCurrentStudentPractice,
  submitCurrentStudentPractice,
} from "@/server/practice/practice";
import {
  requestPracticeAudioUpload,
  completePracticeAudio,
  getPracticeAudioPlayback,
} from "@/server/practice/audio";
export async function uploadPracticeAudioAction(id: string, mime: string) {
  return requestPracticeAudioUpload(id, mime);
}
export async function completePracticeAudioAction(id: string) {
  return completePracticeAudio(id);
}
export async function practiceAudioPlaybackAction(id: string) {
  return getPracticeAudioPlayback(id);
}

export async function startPracticeAction(formData: FormData): Promise<void> {
  const input = startPracticeInputSchema.parse({
    activityId: formData.get("activityId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  const attempt = await startCurrentStudentPractice(input);

  revalidatePath("/pratica");
  redirect(`/pratica?attempt=${attempt.id}`);
}

export async function submitPracticeAction(formData: FormData): Promise<void> {
  const optionId = formData.get("optionId");
  const text = formData.get("responseText");
  const mediaId = formData.get("mediaId");
  const input = submitPracticeInputSchema.parse({
    attemptId: formData.get("attemptId"),
    ...(typeof optionId === "string" && optionId ? { optionId } : {}),
    ...(typeof text === "string" && text.trim() ? { text } : {}),
    ...(typeof mediaId === "string" && mediaId ? { mediaId } : {}),
  });

  await submitCurrentStudentPractice(input);
  revalidatePath("/pratica");
  redirect(`/pratica?attempt=${input.attemptId}&completed=1`);
}
