"use server";

import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  configureCurrentPlacementCohort,
  transferCurrentPlacement,
} from "@/server/placement/placement";
import {
  assignPlacementTeacher,
  reassignPlacementTeacher,
} from "@/server/placement/teacher-assignment";
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
export async function reassignPlacementTeacherAction(form: FormData) {
  await assertRole("ADMIN");
  try {
    await reassignPlacementTeacher({
      caseId: form.get("caseId"),
      teacherId: form.get("teacherId"),
      reason: form.get("reason"),
    });
  } catch {
    redirect("/admin/enrollments?result=error");
  }
  revalidatePath("/admin/enrollments");
  revalidatePath("/teacher/revisoes/placement");
  redirect("/admin/enrollments?result=reassigned");
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

export async function resolveReassessmentAction(form: FormData) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("resolve_reassessment", {
    p_id: z.uuid().parse(form.get("requestId")),
    p_note: z.string().trim().min(1).max(1000).parse(form.get("note")),
  });
  revalidatePath("/admin/enrollments");
  redirect(`/admin/enrollments?result=${error ? "error" : "resolved"}`);
}
