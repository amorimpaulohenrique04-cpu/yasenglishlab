import { PageHeader } from "@/components/ui";
import { loadSessionWorkspace } from "@/server/teacher-operations/session-workspace";
import { SessionForm } from "@/modules/teacher-operations/ui/session-form";
import { safeSessionReturn } from "@/modules/teacher-operations/domain/session-workspace";
import { saveSessionResultAction } from "../actions";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [context, query] = await Promise.all([loadSessionWorkspace(), searchParams]);
  const validInstant = (value?: string) =>
    value && Number.isFinite(Date.parse(value)) ? value : undefined;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Criar sessão"
        description="Organize uma nova sessão dentro da sua disponibilidade."
      />
      <SessionForm
        context={context}
        action={saveSessionResultAction}
        returnTo={safeSessionReturn(query.returnTo)}
        prefill={{ start: validInstant(query.start), end: validInstant(query.end) }}
      />
    </div>
  );
}
