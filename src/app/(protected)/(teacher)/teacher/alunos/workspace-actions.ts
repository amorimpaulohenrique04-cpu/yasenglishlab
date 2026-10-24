"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole, AuthorizationError } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { loadStudentEvents } from "@/server/teacher-operations/student-workspace";
import type { StudentCommandResult } from "@/modules/teacher-operations/domain/student-workspace";

export async function studentEventsAction(kind: string, page: number) {
  return loadStudentEvents(kind, page);
}
export async function studentCommandAction(input: unknown): Promise<StudentCommandResult> {
  try {
    await assertRole("TEACHER");
    const command = z
      .discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("note"),
            studentId: z.uuid(),
            body: z.string().trim().min(1).max(4000),
          })
          .strict(),
        z
          .object({
            kind: z.literal("reassessment"),
            studentId: z.uuid(),
            body: z.string().trim().min(10).max(1000),
          })
          .strict(),
      ])
      .safeParse(input);
    if (!command.success)
      return { ok: false, message: "Confira o texto e o limite de caracteres antes de salvar." };
    const client = await createSupabaseServerClient();
    const { studentId, body, kind } = command.data;
    const result =
      kind === "note"
        ? await client.rpc("create_teacher_note", { p_student: studentId, p_body: body })
        : await client.rpc("request_reassessment", { p_student: studentId, p_reason: body });
    if (result.error)
      return {
        ok: false,
        message: "Não foi possível salvar. Confira seu vínculo com este aluno e tente novamente.",
      };
    revalidatePath("/teacher/alunos");
    revalidatePath(`/teacher/alunos/${studentId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AuthorizationError
          ? "Sua autorização mudou. Atualize a página para continuar."
          : "Não foi possível salvar agora. Seu texto foi preservado.",
    };
  }
}
