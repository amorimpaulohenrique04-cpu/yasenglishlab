"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cohortCommandSchema } from "@/modules/cohorts";
import {
  provisionCurrentAdminTeacher,
  setCurrentAdminTeacherActive,
  setCurrentAdminTeacherCourse,
  TeacherLifecycleBlockedError,
} from "@/server/teachers/teachers";
import { manageCurrentAdminCohort } from "@/server/cohorts/cohorts";

function refreshTeachers() {
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/cohorts");
  revalidatePath("/teacher");
  revalidatePath("/agenda");
}

export async function provisionTeacherAction(form: FormData): Promise<never> {
  let result: "invited" | "linked";
  try {
    const outcome = await provisionCurrentAdminTeacher(form.get("email"));
    result = outcome.invitationRequested ? "invited" : "linked";
  } catch {
    redirect("/admin/teachers?result=error");
  }
  refreshTeachers();
  redirect(`/admin/teachers?result=${result}`);
}

export async function setTeacherActiveAction(form: FormData): Promise<never> {
  const activeValue = form.get("active");
  if (activeValue !== "true" && activeValue !== "false") redirect("/admin/teachers?result=invalid");
  const active = activeValue === "true";
  try {
    await setCurrentAdminTeacherActive(form.get("teacherId"), active);
  } catch (error) {
    if (error instanceof TeacherLifecycleBlockedError)
      redirect("/admin/teachers?result=dependencies");
    redirect("/admin/teachers?result=error");
  }
  refreshTeachers();
  redirect(`/admin/teachers?result=${active ? "activated" : "deactivated"}`);
}

export async function setTeacherCourseAction(form: FormData): Promise<never> {
  const enabledValue = form.get("enabled");
  if (enabledValue !== "true" && enabledValue !== "false")
    redirect("/admin/teachers?result=invalid");
  const enabled = enabledValue === "true";
  try {
    await setCurrentAdminTeacherCourse(form.get("teacherId"), form.get("courseId"), enabled);
  } catch {
    redirect("/admin/teachers?result=error");
  }
  refreshTeachers();
  redirect("/admin/teachers?result=capability");
}

export async function assignTeacherCohortAction(form: FormData): Promise<never> {
  const command = cohortCommandSchema.safeParse({
    operation: "ADD_TEACHER",
    cohortId: form.get("cohortId"),
    input: {
      teacher_id: form.get("teacherId"),
      is_primary: form.get("isPrimary") === "true",
    },
  });
  if (!command.success) redirect("/admin/teachers?result=invalid");
  try {
    await manageCurrentAdminCohort(command.data);
  } catch {
    redirect("/admin/teachers?result=cohort-error");
  }
  refreshTeachers();
  redirect("/admin/teachers?result=cohort");
}
