"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cohortPathSaveInput,
  type CohortPathFormState,
} from "@/modules/admin-cohort-path/domain/models";
import { assertRole } from "@/server/auth/guards";
import { saveAdminCohortPath } from "@/server/admin-cohort-path/admin-cohort-path";

function value(data: FormData, key: string) {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
}
function pathError(message: string): string {
  if (message.includes("requires its parent"))
    return "Todo item precisa do módulo ou da aula a que pertence. Inclua o item pai.";
  if (message.includes("belong to cohort course"))
    return "Há um item que não pertence ao curso desta turma.";
  if (message.includes("Archived cohort")) return "Turma arquivada: a trilha é somente leitura.";
  if (message.includes("Duplicate")) return "Há itens ou posições duplicadas.";
  if (message.includes("limit")) return "A trilha excede o limite de itens.";
  return "Não foi possível salvar a trilha. Confira os itens e as datas.";
}
export async function saveCohortPathAction(
  _previous: CohortPathFormState,
  data: FormData,
): Promise<CohortPathFormState> {
  await assertRole("ADMIN");
  try {
    const raw = value(data, "payload");
    if (raw.length > 600000) return { error: "A trilha excede o tamanho permitido." };
    const cohortId = z.guid().parse(value(data, "cohortId"));
    await saveAdminCohortPath(cohortId, cohortPathSaveInput.parse(JSON.parse(raw)));
    revalidatePath(`/admin/cohorts/${cohortId}/trilha`);
    revalidatePath("/learn");
    return { saved: true };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return { error: "Confira os campos da trilha." };
    return { error: pathError(error instanceof Error ? error.message : "") };
  }
}
