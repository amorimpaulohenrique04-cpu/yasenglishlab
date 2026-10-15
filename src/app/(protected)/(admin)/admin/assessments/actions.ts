"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AssessmentFormState } from "@/modules/admin-assessments/domain/models";
import { assertRole } from "@/server/auth/guards";
import {
  commandAdminAssessment,
  saveAdminAssessment,
} from "@/server/admin-assessments/admin-assessments";

function value(data: FormData, key: string) {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
}
function refresh() {
  revalidatePath("/admin/assessments");
  revalidatePath("/placement");
}
export async function saveAssessmentAction(
  _previous: AssessmentFormState,
  data: FormData,
): Promise<AssessmentFormState> {
  await assertRole("ADMIN");
  let saved;
  try {
    const raw = value(data, "payload");
    if (raw.length > 400000) return { error: "A avaliação excede o tamanho permitido." };
    saved = await saveAdminAssessment(
      value(data, "id") || null,
      value(data, "versionId") || null,
      JSON.parse(raw),
    );
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "Confira os campos, as alternativas e o gabarito de cada questão."
          : "Não foi possível salvar. Confira os dados e se a versão ainda é um rascunho.",
    };
  }
  refresh();
  redirect(`/admin/assessments/${saved.assessmentId}?version=${saved.versionId}&saved=1`);
}
export async function changeAssessmentAction(data: FormData): Promise<void> {
  await assertRole("ADMIN");
  const id = z.uuid().parse(value(data, "id"));
  const command = z.enum(["publish", "new_version", "retire"]).parse(value(data, "command"));
  let version: string | undefined;
  try {
    const result = await commandAdminAssessment(
      command,
      command === "new_version" ? id : value(data, "versionId"),
      value(data, "makePlacement") === "on",
    );
    if (command === "new_version")
      version = z.object({ versionId: z.uuid() }).parse(result).versionId;
  } catch {
    redirect(`/admin/assessments/${id}?error=${command}`);
  }
  refresh();
  redirect(`/admin/assessments/${id}?${version ? `version=${version}&` : ""}changed=1`);
}
