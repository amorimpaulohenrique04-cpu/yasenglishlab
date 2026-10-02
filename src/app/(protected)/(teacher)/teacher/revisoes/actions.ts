"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RUBRIC_DIMENSIONS, RUBRIC_LEVELS } from "@/modules/practice/domain/rubric";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getPracticeAudioPlayback } from "@/server/practice/audio";
export async function reviewPracticeAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("attemptId"));
  const skill = z.enum(["SPEAKING", "PRONUNCIATION"]).parse(form.get("skill"));
  const ratings = Object.fromEntries(
    RUBRIC_DIMENSIONS[skill].map((dimension) => [
      dimension,
      z.enum(RUBRIC_LEVELS).parse(form.get(dimension)),
    ]),
  );
  const feedback = z.string().trim().min(1).max(4000).parse(form.get("feedback"));
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("finalize_practice_review", {
    p_attempt: id,
    p_ratings: ratings,
    p_feedback: feedback,
    p_rubric_version: "v1",
  });
  if (error) redirect(`/teacher/revisoes/${id}?save=error`);
  revalidatePath("/teacher/revisoes");
  revalidatePath("/pratica");
  redirect(`/teacher/revisoes/${id}?save=success`);
}
export async function teacherAudioPlaybackAction(id: string) {
  await assertRole("TEACHER");
  return getPracticeAudioPlayback(id);
}
