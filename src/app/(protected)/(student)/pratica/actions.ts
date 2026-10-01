"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { startPracticeInputSchema, submitPracticeInputSchema } from "@/modules/practice";
import {
  startCurrentStudentPractice,
  submitCurrentStudentPractice,
} from "@/server/practice/practice";

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
  const input = submitPracticeInputSchema.parse({
    attemptId: formData.get("attemptId"),
    ...(typeof optionId === "string" && optionId ? { optionId } : {}),
    ...(typeof text === "string" && text.trim() ? { text } : {}),
  });

  await submitCurrentStudentPractice(input);
  revalidatePath("/pratica");
  redirect(`/pratica?attempt=${input.attemptId}&completed=1`);
}
