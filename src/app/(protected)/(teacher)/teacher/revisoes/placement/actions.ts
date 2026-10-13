"use server";

import { assertRole } from "@/server/auth/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { finalizeCurrentPlacementReview } from "@/server/placement/placement";
export async function finalizePlacementReviewAction(form: FormData) {
  await assertRole("TEACHER");
  const id = z.uuid().parse(form.get("caseId"));
  try {
    await finalizeCurrentPlacementReview({
      caseId: id,
      courseId: form.get("courseId"),
      feedback: form.get("feedback"),
      confidence: form.get("confidence"),
    });
  } catch {
    redirect(`/teacher/revisoes/placement/${id}?result=error`);
  }
  revalidatePath("/teacher/revisoes/placement");
  revalidatePath("/onboarding");
  revalidatePath("/home");
  redirect(`/teacher/revisoes/placement/${id}?result=success`);
}
