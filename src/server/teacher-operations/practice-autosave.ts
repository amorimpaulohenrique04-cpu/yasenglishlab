import "server-only";

import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { PracticeSaveResult } from "@/modules/teacher-operations/domain/practice-autosave";
import { teacherPracticeSaveInputSchema } from "./practice-commands";

const resultSchema = z.object({
  status: z.enum(["saved", "conflict"]),
  id: z.uuid(),
  updatedAt: z.string(),
});

export async function autosaveTeacherPractice(
  raw: unknown,
  creationKey: string,
  expected: string | null,
): Promise<PracticeSaveResult> {
  await assertRole("TEACHER");
  const parsed = teacherPracticeSaveInputSchema.safeParse(raw);
  if (!parsed.success || parsed.data.content.version !== 3) {
    return { status: "invalid", message: "Confira os dados da prática antes de salvar." };
  }
  const input = parsed.data;
  if (!input.relatedModuleId || !input.relatedLessonId) {
    return { status: "invalid", message: "Escolha curso, módulo e aula para salvar." };
  }
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_practice_autosave", {
    p_id: input.id,
    p_creation_key: z.uuid().parse(creationKey),
    p_expected: expected === null ? null : z.iso.datetime({ offset: true }).parse(expected),
    p_payload: {
      title: input.title,
      skill: input.skill,
      cefr_target: input.cefrTarget ?? null,
      difficulty: input.difficulty ?? null,
      estimated_minutes: input.estimatedMinutes,
      course_id: input.courseId,
      related_module_id: input.relatedModuleId,
      related_lesson_id: input.relatedLessonId,
      content: input.content,
    },
    p_item_keys: input.itemKeys ?? {},
  });
  if (error) {
    return {
      status: error.code === "23514" ? "invalid" : "unavailable",
      message:
        error.code === "23514"
          ? "Confira o vínculo com a aula e os campos da prática."
          : "Não foi possível salvar. Tente novamente.",
    };
  }
  return resultSchema.parse(data);
}
