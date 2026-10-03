import "server-only";
import type {
  TeacherSessionCommandPort,
  TeacherSessionInput,
} from "@/modules/teacher-operations/domain/session-input";
import { saveTeacherSession } from "@/modules/teacher-operations/domain/session-input";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { withObservedSpan } from "@/server/observability/trace";

class SupabaseTeacherSessionCommands implements TeacherSessionCommandPort {
  async saveSession(id: string | null, input: TeacherSessionInput): Promise<string> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("manage_teacher_session", {
      p_id: id,
      p_input: input,
    });
    if (error || typeof data !== "string")
      throw new Error("Sessão rejeitada. Confira disponibilidade, escopo e reservas existentes.");
    return data;
  }
}
export async function saveCurrentTeacherSession(id: string | null, input: unknown) {
  const actor = await assertRole("TEACHER");
  return withObservedSpan(
    {
      name: id ? "teacher.session.update" : "teacher.session.create",
      stage: "teacher.session.command",
      impact: "request_failed",
      errorCode: "database_error",
      userId: actor.userId,
      metadata: { session_id: id },
    },
    () => saveTeacherSession(new SupabaseTeacherSessionCommands(), id, input),
  );
}
