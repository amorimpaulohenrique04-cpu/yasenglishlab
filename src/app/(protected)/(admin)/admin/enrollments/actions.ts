"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  configureCurrentPlacementCohort,
  transferCurrentPlacement,
} from "@/server/placement/placement";
function minutes(value: FormDataEntryValue | null) {
  const [h, m] = String(value ?? "")
    .split(":")
    .map(Number);
  return h! * 60 + m!;
}
export async function configurePlacementCohortAction(form: FormData) {
  try {
    await configureCurrentPlacementCohort({
      cohortId: form.get("cohortId"),
      capacity: Number(form.get("capacity")),
      schedule: [
        {
          weekday: Number(form.get("weekday")),
          startMinute: minutes(form.get("start")),
          endMinute: minutes(form.get("end")),
        },
      ],
    });
  } catch {
    redirect("/admin/enrollments?result=error");
  }
  revalidatePath("/onboarding/placement");
  redirect("/admin/enrollments?result=configured");
}
export async function transferPlacementAction(form: FormData) {
  try {
    await transferCurrentPlacement({
      caseId: form.get("caseId"),
      cohortId: form.get("cohortId"),
      operationId: form.get("operationId"),
      reason: form.get("reason"),
    });
  } catch {
    redirect("/admin/enrollments?result=error");
  }
  revalidatePath("/onboarding/placement");
  revalidatePath("/home");
  redirect("/admin/enrollments?result=transferred");
}
