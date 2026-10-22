import { Breadcrumbs, PageHeader } from "@/components/ui";
import { loadSessionWorkspace } from "@/server/teacher-operations/session-workspace";
import { SessionForm } from "@/modules/teacher-operations/ui/session-form";
import { safeSessionReturn } from "@/modules/teacher-operations/domain/session-workspace";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";
import { saveSessionResultAction } from "../actions";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [context, query] = await Promise.all([loadSessionWorkspace(), searchParams]);
  const validInstant = (value?: string) =>
    value && Number.isFinite(Date.parse(value)) ? value : undefined;
  const back = safeSessionReturn(query.returnTo);
  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Sessões", href: back }, { label: "Criar sessão" }]}
      />
      <PageHeader
        title="Criar sessão"
        description="Organize uma nova sessão dentro da sua disponibilidade e convide sua turma."
      />
      <SessionForm
        context={context}
        action={saveSessionResultAction}
        returnTo={back}
        prefill={{ start: validInstant(query.start), end: validInstant(query.end) }}
      />
    </div>
  );
}
