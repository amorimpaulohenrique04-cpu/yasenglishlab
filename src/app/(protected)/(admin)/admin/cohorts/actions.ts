"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cohortCommandSchema } from "@/modules/cohorts";
import {
  configureCurrentAdminCohort,
  manageCurrentAdminCohort,
  setCurrentAdminPrimaryTeacher,
} from "@/server/cohorts/cohorts";
import { z } from "zod";

function cohortReturnUrl(form: FormData, result: string) {
  const params = new URLSearchParams({ result });
  const query = form.get("returnQuery");
  const offset = form.get("returnOffset");
  if (typeof query === "string" && query.trim()) params.set("q", query.slice(0, 120));
  if (typeof offset === "string" && /^\d{1,5}$/.test(offset)) params.set("offset", offset);
  return `/admin/cohorts?${params.toString()}`;
}

export async function manageCohortAction(form: FormData) {
  const operation = String(form.get("operation"));
  const input =
    operation === "CREATE"
      ? {
          course_id: form.get("course_id"),
          name: form.get("name"),
          code: form.get("code"),
          starts_at: form.get("starts_at"),
          ends_at: form.get("ends_at") || null,
          timezone: form.get("timezone") || "America/Recife",
        }
      : operation === "EDIT"
        ? { name: form.get("name") }
        : operation === "STATUS"
          ? { status: form.get("status") }
          : operation.endsWith("STUDENT")
            ? { user_id: form.get("user_id") }
            : { teacher_id: form.get("teacher_id"), is_primary: form.get("is_primary") === "on" };
  const parsed = cohortCommandSchema.safeParse({
    operation,
    cohortId: form.get("cohortId") || null,
    input,
  });
  if (!parsed.success) redirect(cohortReturnUrl(form, "invalid"));
  try {
    await manageCurrentAdminCohort(parsed.data);
  } catch {
    redirect(cohortReturnUrl(form, "error"));
  }
  revalidatePath("/admin/cohorts");
  revalidatePath("/agenda");
  revalidatePath("/teacher");
  redirect(cohortReturnUrl(form, "success"));
}

const uuid = z.string().uuid();
const timeToMinute = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export async function configureCohortAction(form: FormData) {
  const cohortId = uuid.safeParse(form.get("cohortId"));
  const capacity = z.coerce.number().int().min(1).max(6).safeParse(form.get("capacity"));
  const schedule: { weekday: number; startMinute: number; endMinute: number }[] = [];
  let invalid = false;
  for (let slot = 0; slot < 7; slot += 1) {
    const weekdayValue = form.get(`weekday_${slot}`);
    const startValue = form.get(`start_${slot}`);
    const endValue = form.get(`end_${slot}`);
    if (weekdayValue === "" && startValue === "" && endValue === "") continue;
    const weekday = z.coerce.number().int().min(0).max(6).safeParse(weekdayValue);
    const startMinute = timeToMinute(startValue);
    const endMinute = endValue === "24:00" ? 1440 : timeToMinute(endValue);
    if (
      !weekday.success ||
      startMinute === null ||
      endMinute === null ||
      endMinute <= startMinute
    ) {
      invalid = true;
      break;
    }
    schedule.push({ weekday: weekday.data, startMinute, endMinute });
  }
  if (!cohortId.success || !capacity.success || invalid || schedule.length === 0) {
    redirect(cohortReturnUrl(form, "invalid"));
  }
  try {
    await configureCurrentAdminCohort(cohortId.data, capacity.data, schedule);
  } catch {
    redirect(cohortReturnUrl(form, "error"));
  }
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/enrollments");
  redirect(cohortReturnUrl(form, "success"));
}

export async function setPrimaryTeacherAction(form: FormData) {
  const cohortId = uuid.safeParse(form.get("cohortId"));
  const teacherId = uuid.safeParse(form.get("teacherId"));
  if (!cohortId.success || !teacherId.success) redirect(cohortReturnUrl(form, "invalid"));
  try {
    await setCurrentAdminPrimaryTeacher(cohortId.data, teacherId.data);
  } catch {
    redirect(cohortReturnUrl(form, "error"));
  }
  revalidatePath("/admin/cohorts");
  revalidatePath("/teacher");
  redirect(cohortReturnUrl(form, "success"));
}
