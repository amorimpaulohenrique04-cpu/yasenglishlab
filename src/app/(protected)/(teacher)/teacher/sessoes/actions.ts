"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { saveCurrentTeacherSession } from "@/server/teacher-operations/session-commands";
import { getLiveSessionJoinAccess } from "@/server/schedule/meeting-access";
import { localAvailabilityToIso } from "@/modules/teacher-operations/domain/availability-time";
import {
  teacherSessionInputSchema,
  googleMeetUrlSchema,
} from "@/modules/teacher-operations/domain/session-input";
import type { SessionMutationResult } from "@/modules/teacher-operations/domain/session-workspace";

export async function saveSessionResultAction(form: FormData): Promise<SessionMutationResult> {
  await assertRole("TEACHER");
  const idValue = form.get("id");
  if (idValue && !z.uuid().safeParse(idValue).success)
    return { ok: false, message: "Sessão inválida." };
  const id = idValue ? String(idValue) : null;
  let starts: string, ends: string;
  try {
    starts = localAvailabilityToIso(
      String(form.get("session_date")),
      String(form.get("start_time")),
    );
    ends = localAvailabilityToIso(
      String(form.get("end_date") || form.get("session_date")),
      String(form.get("end_time")),
    );
  } catch {
    return {
      ok: false,
      message: "Confira a data e os horários.",
      fields: { session_date: "Informe uma data e horários válidos." },
    };
  }
  const parsed = teacherSessionInputSchema.safeParse({
    title: form.get("title"),
    session_type: form.get("session_type"),
    starts_at: starts,
    ends_at: ends,
    capacity: form.get("capacity"),
    cohort_id: form.get("cohort_id") || null,
    target_student_user_id: form.get("target_student_user_id") || null,
    ...(form.get("meeting_url") ? { meeting_url: form.get("meeting_url") } : {}),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    const messages: Record<string, string> = {
      title: "Informe um título com até 200 caracteres.",
      session_type: "Selecione um tipo de sessão válido.",
      capacity: "Informe uma capacidade entre 1 e 6.",
      cohort_id: "Selecione uma turma válida.",
      target_student_user_id: "Selecione um aluno válido.",
      meeting_url: "Informe um link válido do Google Meet.",
      end_time: "O término deve ser após o início.",
    };
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "end_time");
      fields[key] = messages[key] ?? "Confira este campo.";
    }
    return { ok: false, message: "Confira os campos indicados.", fields };
  }
  if (Date.parse(starts) <= Date.now())
    return {
      ok: false,
      message: "Escolha um horário futuro.",
      fields: { start_time: "O início deve estar no futuro." },
    };
  if (
    parsed.data.session_type === "PRIVATE_SESSION" &&
    (!parsed.data.target_student_user_id || parsed.data.capacity !== 1 || parsed.data.cohort_id)
  )
    return {
      ok: false,
      message: "A sessão particular exige um aluno autorizado, capacidade um e nenhuma turma.",
      fields: {
        target_student_user_id: "Selecione um aluno autorizado.",
        capacity: "Sessão particular tem capacidade um.",
      },
    };
  if (
    parsed.data.session_type !== "PRIVATE_SESSION" &&
    (!parsed.data.cohort_id || parsed.data.target_student_user_id)
  )
    return {
      ok: false,
      message: "Selecione uma turma autorizada para a sessão em grupo.",
      fields: { cohort_id: "A turma é obrigatória." },
    };
  try {
    const sessionId = await saveCurrentTeacherSession(id, parsed.data);
    revalidatePath("/teacher", "layout");
    revalidatePath("/agenda");
    return { ok: true, sessionId };
  } catch {
    return {
      ok: false,
      message:
        "A sessão não foi salva. Confira disponibilidade, sobreposição, vínculo da turma ou aluno e reservas existentes. Seus dados foram mantidos.",
    };
  }
}

export async function cancelSessionResultAction(id: string): Promise<SessionMutationResult> {
  await assertRole("TEACHER");
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Sessão inválida." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("cancel_teacher_live_session", { p_live_session_id: id });
  if (error)
    return {
      ok: false,
      message:
        "Não foi possível cancelar. A sessão deve estar agendada e sem presença registrada. Atualize os dados e tente novamente.",
    };
  revalidatePath("/teacher", "layout");
  revalidatePath("/agenda");
  revalidatePath("/home");
  return { ok: true, sessionId: id };
}

export async function saveMeetingResultAction(
  id: string,
  url: string,
): Promise<SessionMutationResult> {
  await assertRole("TEACHER");
  if (!z.uuid().safeParse(id).success || !googleMeetUrlSchema.safeParse(url).success)
    return { ok: false, message: "Selecione uma sessão e informe um link válido do Google Meet." };
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("manage_teacher_session", {
    p_id: id,
    p_input: { meeting_url: url.trim() },
  });
  if (error)
    return {
      ok: false,
      message: "O link não foi salvo. Selecione uma sessão futura, própria e editável.",
    };
  revalidatePath("/teacher", "layout");
  revalidatePath("/agenda");
  return { ok: true, sessionId: id };
}

export async function teacherJoinAction(id: string) {
  await assertRole("TEACHER");
  return getLiveSessionJoinAccess(id);
}
