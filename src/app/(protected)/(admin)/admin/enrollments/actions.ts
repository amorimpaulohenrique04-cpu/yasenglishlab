"use server";

import { assertRole } from "@/server/auth/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  configureCurrentPlacementCohort,
  transferCurrentPlacement,
} from "@/server/placement/placement";
import { assignPlacementTeacher } from "@/server/placement/teacher-assignment";
function minutes(value: FormDataEntryValue | null) {
  const [h, m] = String(value ?? "")
    .split(":")
    .map(Number);
  return h! * 60 + m!;
}
export async function configurePlacementCohortAction(form: FormData) {
  await assertRole("ADMIN");
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
export async function assignPlacementTeacherAction(form: FormData) {
  await assertRole("ADMIN");
  try {
    await assignPlacementTeacher({
      caseId: form.get("caseId"),
      teacherId: form.get("teacherId"),
    });
  } catch {
    redirect("/admin/enrollments?result=error");
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/teacher/revisoes/placement");
  redirect("/admin/enrollments?result=assigned");
}
export async function transferPlacementAction(form: FormData) {
  await assertRole("ADMIN");
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
