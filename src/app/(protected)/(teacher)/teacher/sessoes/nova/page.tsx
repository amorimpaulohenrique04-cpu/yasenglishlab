import { Alert, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import { SessionForm } from "@/modules/teacher-operations/ui/session-form";
import { saveSessionAction } from "../actions";
export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ save?: string }>;
}) {
  const context = await loadTeacherOperationContext();
  return (
    <>
      <PageHeader
        title="Novo encontro"
        description="Prepare uma sessão dentro da sua disponibilidade."
      />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Sessão não criada"
          description="Confira os horários, a disponibilidade e o vínculo da turma ou aluno."
        />
      )}
      <SessionForm context={context} action={saveSessionAction} />
    </>
  );
}
