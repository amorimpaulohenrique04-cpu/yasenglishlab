"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SubscriptionSuspendedError } from "@/modules/billing/domain/access";
import {
  PracticeLessonNotReachedError,
  PracticeNothingDueError,
  startPracticeInputSchema,
  submitPracticeInputSchema,
  type PracticeConfidence,
  type PracticeFinalizeResult,
  type PracticeItemInput,
  type PracticeItemResult,
  type PracticeItemRound,
} from "@/modules/practice";
import type { PracticePlayerOutcome } from "@/modules/practice/ui/practice-player";
import type {
  PracticeFinalAnswers,
  PracticeFinalDraft,
  PracticeFinalOutcome,
} from "@/modules/practice/ui/practice-session-player.types";
import {
  saveCurrentStudentFinalDraft,
  submitCurrentStudentFinalAttempt,
} from "@/server/practice/final-attempt";
import {
  finalizeCurrentStudentPractice,
  startCurrentStudentReview,
  submitCurrentStudentPracticeItem,
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
  let attempt: Awaited<ReturnType<typeof startCurrentStudentPractice>>;
  try {
    attempt = await startCurrentStudentPractice(input);
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    if (error instanceof PracticeLessonNotReachedError) redirect("/pratica?bloqueada=1");
    throw error;
  }

  revalidatePath("/pratica");
  redirect(`/pratica/${attempt.id}`);
}

/** Spaced review of the questions due for one practice (same gating errors as a normal start). */
export async function startPracticeReviewAction(formData: FormData): Promise<void> {
  const input = startPracticeInputSchema.parse({
    activityId: formData.get("activityId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  let attempt: Awaited<ReturnType<typeof startCurrentStudentReview>>;
  try {
    attempt = await startCurrentStudentReview(input);
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    if (error instanceof PracticeLessonNotReachedError) redirect("/pratica?bloqueada=1");
    if (error instanceof PracticeNothingDueError) redirect("/pratica?semrevisao=1");
    throw error;
  }

  revalidatePath("/pratica");
  redirect(`/pratica/${attempt.id}`);
}

/** Grades one item of a v3 attempt and returns the outcome so the player shows it in place. */
export async function submitPracticeItemAction(
  attemptId: string,
  input: {
    itemId: string;
    round: PracticeItemRound;
    response: PracticeItemInput;
    confidence: PracticeConfidence | null;
  },
): Promise<PracticeItemResult> {
  try {
    return await submitCurrentStudentPracticeItem({ ...input, attemptId });
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    throw error;
  }
}

export async function finalizePracticeAction(attemptId: string): Promise<PracticeFinalizeResult> {
  let result: PracticeFinalizeResult;
  try {
    result = await finalizeCurrentStudentPractice(attemptId);
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    throw error;
  }
  revalidatePath("/pratica");
  return result;
}

export async function savePracticeFinalDraftAction(
  attemptId: string,
  answers: PracticeFinalAnswers,
): Promise<PracticeFinalDraft> {
  return saveCurrentStudentFinalDraft(attemptId, answers);
}

export async function submitPracticeFinalAction(attemptId: string): Promise<PracticeFinalOutcome> {
  const outcome = await submitCurrentStudentFinalAttempt(attemptId);
  revalidatePath("/pratica");
  revalidatePath(`/pratica/${attemptId}`);
  return outcome;
}

export async function uploadPracticeItemAudioAction(
  attemptId: string,
  itemId: string,
  mime: string,
) {
  return requestPracticeAudioUpload(attemptId, mime, itemId);
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

  try {
    await submitCurrentStudentPractice(input);
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    throw error;
  }
  revalidatePath("/pratica");
  revalidatePath(`/pratica/${input.attemptId}`);
  redirect(`/pratica/${input.attemptId}?completed=1`);
}

/**
 * Content v2 submit used by `PracticePlayer`: returns the grading outcome instead of redirecting, so the
 * player shows the result in place. Validation and grading stay in `submit_practice_attempt`.
 */
export async function submitPracticeV2Action(
  attemptId: string,
  response: unknown,
): Promise<PracticePlayerOutcome> {
  const input = submitPracticeInputSchema.parse({
    ...(typeof response === "object" && response !== null ? response : {}),
    attemptId,
  });
  let result: Awaited<ReturnType<typeof submitCurrentStudentPractice>>;
  try {
    result = await submitCurrentStudentPractice(input);
  } catch (error) {
    if (error instanceof SubscriptionSuspendedError) redirect("/pratica?suspended=1");
    throw error;
  }
  return { status: result.evaluationStatus, feedback: result.feedback };
}
