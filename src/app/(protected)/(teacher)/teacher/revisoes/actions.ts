"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PRACTICE_SKILLS } from "@/modules/domain";
import { RUBRIC_LEVELS, rubricDimensionsFor } from "@/modules/practice/domain/rubric";
import { assertRole } from "@/server/auth/guards";
import { loadReviewQueuePosition, loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import { finalizeTeacherPracticeReview } from "@/server/teacher-operations/practice-commands";
import { getPracticeAudioPlayback } from "@/server/practice/audio";
export async function reviewPracticeAction(_state: null, form: FormData): Promise<null> {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("attemptId"));
  const skill = z.enum(PRACTICE_SKILLS).parse(form.get("skill"));
  // Optional: v2 WRITTEN/SPOKEN reviews post the activity response type; the database re-validates the rubric.
  const responseType = z.string().max(40).nullish().parse(form.get("responseType"));
  const ratings = Object.fromEntries(
    rubricDimensionsFor(skill, responseType).map((dimension) => [
      dimension,
      z.enum(RUBRIC_LEVELS).parse(form.get(dimension)),
    ]),
  );
  const feedback = z.string().trim().min(1).max(4000).parse(form.get("feedback"));
  // v3 attempts review one manual item at a time; the item id selects the finalize_practice_review overload.
  const itemId = z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullish()
    .parse(form.get("itemId") || null);
  // "Finalizar e ir para a próxima" only states the intent; the destination is decided below from fresh data.
  const advance = form.get("intent") === "next";
  let failed = false;
  try {
    await finalizeTeacherPracticeReview({ attemptId: id, itemId, ratings, feedback });
  } catch {
    failed = true;
  }
  if (failed) redirect(`/teacher/revisoes/${id}?save=error`);
  revalidatePath("/teacher/revisoes");
  revalidatePath(`/teacher/revisoes/${id}`);
  revalidatePath("/pratica");
  revalidatePath(`/pratica/${id}`);
  revalidatePath("/feedbacks");
  // Re-read the attempt: while any open answer is pending, the Teacher stays on it (the next pending
  // answer becomes the active one, in question order). Only a finished attempt moves to the next one.
  const remaining = await loadTeacherReviews(id).then(
    (items) => items.filter((item) => item.status === "PENDING_MANUAL").length,
    // Unknown state: staying on the attempt never skips a pending answer.
    () => 1,
  );
  if (remaining > 0 || !advance) redirect(`/teacher/revisoes/${id}?save=success`);
  const { next } = await loadReviewQueuePosition(id).catch(() => ({ next: null }));
  redirect(next ? `/teacher/revisoes/${next}?save=success` : "/teacher/revisoes");
}
export async function teacherAudioPlaybackAction(id: string) {
  await assertRole("TEACHER");
  return getPracticeAudioPlayback(id);
}
