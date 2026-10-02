import { Button, Card, Input, Select } from "@/components/ui";
import styles from "./teacher-operations.module.css";
type Context = Awaited<
  ReturnType<
    typeof import("@/server/teacher-operations/operation-context").loadTeacherOperationContext
  >
>;
export function SessionForm({
  context,
  action,
  session,
}: {
  context: Context;
  action: (form: FormData) => Promise<void>;
  session?: Context["sessions"][number];
}) {
  const locked = session?.has_bookings ?? false;
  return (
    <Card>
      <form action={action} className={styles.operationForm}>
        {session && <input type="hidden" name="id" value={session.id} />}
        <Input label="Título" name="title" required maxLength={200} defaultValue={session?.title} />
        <Select
          label="Tipo"
          name="session_type"
          defaultValue={session?.session_type ?? "CORE_CLASS"}
          disabled={Boolean(session)}
          options={[
            { value: "CORE_CLASS", label: "Core Class" },
            { value: "CONVERSATION_LAB", label: "Conversation Lab" },
            { value: "PRIVATE_SESSION", label: "Sessão particular" },
          ]}
        />
        {session && <input type="hidden" name="session_type" value={session.session_type} />}
        <Input
          label="Início (data e hora com fuso)"
          name="starts_at"
          required
          placeholder="2026-10-10T10:00:00-03:00"
          defaultValue={session?.starts_at}
          readOnly={locked}
        />
        <Input
          label="Término (data e hora com fuso)"
          name="ends_at"
          required
          placeholder="2026-10-10T11:00:00-03:00"
          defaultValue={session?.ends_at}
          readOnly={locked}
        />
        <Input
          label="Capacidade"
          name="capacity"
          type="number"
          min={1}
          max={6}
          required
          defaultValue={session?.capacity ?? 6}
          readOnly={locked}
        />
        <Select
          label="Turma (encontros em grupo)"
          name="cohort_id"
          defaultValue={session?.cohort_id ?? ""}
          disabled={locked}
          options={[
            { value: "", label: "Sem turma" },
            ...context.cohorts.map((item) => ({ value: item.id, label: item.name ?? "Turma" })),
          ]}
        />
        <Select
          label="Aluno (sessão particular)"
          name="target_student_user_id"
          defaultValue={session?.target_student_user_id ?? ""}
          disabled={locked}
          options={[
            { value: "", label: "Sem destinatário" },
            ...context.students.map((item) => ({ value: item.id, label: item.name ?? "Aluno" })),
          ]}
        />
        {locked && (
          <>
            <input type="hidden" name="cohort_id" value={session?.cohort_id ?? ""} />
            <input
              type="hidden"
              name="target_student_user_id"
              value={session?.target_student_user_id ?? ""}
            />
            <p>
              Há reservas: mudanças de horário ou estrutura exigem cancelar e criar outro encontro.
            </p>
          </>
        )}
        <Input
          label="URL HTTPS da reunião"
          name="meeting_url"
          type="url"
          maxLength={2048}
          placeholder="https://…"
        />
        {session && <p>Informe a URL para atualizar a reunião.</p>}
        <Button type="submit">Salvar encontro</Button>
      </form>
    </Card>
  );
}
