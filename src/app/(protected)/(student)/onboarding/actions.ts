"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  beginCurrentPlacement,
  saveCurrentPreferences,
  startCurrentPlacementAssessment,
  openCurrentDecision,
  confirmCurrentChoice,
} from "@/server/placement/placement";
import {
  recordCurrentStudentAssessmentResponse,
  completeCurrentStudentAssessment,
} from "@/server/assessments/assessments";
import { preferenceSchema } from "@/modules/placement";

export async function beginOnboardingAction() {
  try {
    await beginCurrentPlacement();
  } catch {
    redirect("/onboarding?result=error");
  }
  revalidatePath("/onboarding");
  redirect("/onboarding");
}
function minutes(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^\d{2}:\d{2}$/.test(text)) return NaN;
  const [h, m] = text.split(":").map(Number);
  return h! * 60 + m!;
}
export async function savePreferencesAction(form: FormData) {
  const parsed = preferenceSchema.safeParse({
    timezone: form.get("timezone"),
    weekday: Number(form.get("weekday")),
    startMinute: minutes(form.get("start")),
    endMinute: minutes(form.get("end")),
  });
  if (!parsed.success) redirect("/onboarding?result=invalid");
  try {
    await saveCurrentPreferences(parsed.data);
  } catch {
    redirect("/onboarding?result=error");
  }
  revalidatePath("/onboarding");
  redirect("/onboarding?result=saved");
}
export async function startPlacementAssessmentAction() {
  try {
    await startCurrentPlacementAssessment();
  } catch {
    redirect("/onboarding/assessment?result=error");
  }
  revalidatePath("/onboarding");
  redirect("/onboarding/assessment");
}
export async function saveAssessmentAnswerAction(input: {
  attemptId: string;
  itemId: string;
  response: Record<string, unknown>;
}) {
  try {
    await recordCurrentStudentAssessmentResponse(input);
    return { ok: true } as const;
  } catch {
    return { ok: false } as const;
  }
}
export async function submitAssessmentAction(attemptId: string) {
  try {
    await completeCurrentStudentAssessment({ attemptId });
    revalidatePath("/onboarding");
    revalidatePath("/home");
    return { ok: true } as const;
  } catch {
    return { ok: false } as const;
  }
}
export async function openDecisionAction() {
  try {
    await openCurrentDecision();
  } catch {
    redirect("/onboarding?result=error");
  }
  revalidatePath("/onboarding");
  redirect("/onboarding/placement");
}
export async function confirmChoiceAction(form: FormData) {
  try {
    await confirmCurrentChoice({ cohortId: form.get("cohortId") });
  } catch {
    redirect("/onboarding/placement?result=error");
  }
  revalidatePath("/home");
  revalidatePath("/onboarding");
  redirect("/onboarding/placement?result=success");
}
