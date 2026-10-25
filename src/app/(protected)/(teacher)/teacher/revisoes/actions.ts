"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PRACTICE_SKILLS } from "@/modules/domain";
import { RUBRIC_LEVELS, rubricDimensionsFor } from "@/modules/practice/domain/rubric";
import { assertRole } from "@/server/auth/guards";
import { finalizeTeacherPracticeReview } from "@/server/teacher-operations/practice-commands";
import { getPracticeAudioPlayback } from "@/server/practice/audio";
export async function reviewPracticeAction(form: FormData) {
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
  // "Finalizar e ir para a próxima" posts the next attempt id; navigation only, no rule change.
  const next = z
    .uuid()
    .nullish()
    .parse(form.get("next") || null);
  let failed = false;
  try {
    await finalizeTeacherPracticeReview({ attemptId: id, itemId, ratings, feedback });
  } catch {
    failed = true;
  }
  if (failed) redirect(`/teacher/revisoes/${id}?save=error`);
  revalidatePath("/teacher/revisoes");
  revalidatePath("/pratica");
  redirect(`/teacher/revisoes/${next ?? id}?save=success`);
}
export async function teacherAudioPlaybackAction(id: string) {
  await assertRole("TEACHER");
  return getPracticeAudioPlayback(id);
}
