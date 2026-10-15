"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  enrollErrorMessage,
  enrollNextCourseInput,
  type EnrollFormState,
} from "@/modules/admin-cohort-path/domain/models";
import { assertRole } from "@/server/auth/guards";
import { enrollStudentInNextCourse } from "@/server/admin-cohort-path/admin-cohort-path";

function value(data: FormData, key: string) {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
}
export async function enrollNextCourseAction(
  _previous: EnrollFormState,
  data: FormData,
): Promise<EnrollFormState> {
  await assertRole("ADMIN");
  const parsed = enrollNextCourseInput.safeParse({
    userId: value(data, "userId"),
    courseId: value(data, "courseId"),
    cohortId: value(data, "cohortId"),
    reason: value(data, "reason"),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues.some((i) => i.path[0] === "reason")
        ? "Informe o motivo da matrícula (até 1000 caracteres)."
        : "Escolha o curso e uma turma ativa.",
    };
  try {
    const receipt = await enrollStudentInNextCourse(randomUUID(), parsed.data);
    revalidatePath(`/admin/students/${parsed.data.userId}`);
    revalidatePath("/admin/cohorts");
    return { receipt };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { error: "Não foi possível ler o recibo da matrícula." };
    return { error: enrollErrorMessage(error instanceof Error ? error.message : "") };
  }
}
