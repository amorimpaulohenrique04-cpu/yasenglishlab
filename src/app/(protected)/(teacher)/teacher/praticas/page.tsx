import Link from "next/link";

import { Alert, Badge, Button, DataTable, EmptyState, PageHeader } from "@/components/ui";
import {
  RESPONSE_LABELS,
  SAVE_ERROR_COPY,
  SKILL_LABELS,
  STIMULUS_LABELS,
  isResponseType,
  isStimulusType,
} from "@/modules/teacher-operations/ui/practice-builder-logic";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { assertRole } from "@/server/auth/guards";
import { listTeacherPractices } from "@/server/teacher-operations/practice-commands";

import { duplicatePracticeAction } from "./actions";

export default async function TeacherPracticesPage({
  searchParams,
}: {
  searchParams: Promise<{ save?: string; reason?: string }>;
}) {
  await assertRole("TEACHER");
  const [items, query] = await Promise.all([listTeacherPractices(), searchParams]);
  const error = SAVE_ERROR_COPY[query.reason ?? ""] ?? SAVE_ERROR_COPY.UNAVAILABLE!;
  const create = (
    <Link className="yas-button yas-button--primary" href="/teacher/praticas/nova">
      Criar prática
    </Link>
  );
  return (
    <div className={styles.page}>
      <PageHeader
        title="Práticas"
        description="Crie atividades, publique e atribua às suas turmas."
        actions={items.length > 0 ? create : undefined}
      />
      {query.save === "error" && (
        <Alert tone="error" title={error.title} description={error.description} />
      )}
      {query.save === "success" && <Alert tone="success" title="Alteração concluída" />}
      {items.length === 0 && (
        <EmptyState
          title="Você ainda não criou práticas"
          description="Monte uma atividade com texto, imagem, áudio ou vídeo e atribua a uma turma."
        />
      )}
      {items.length === 0 && create}
      {items.length > 0 && (
        <DataTable
          caption="Minhas práticas"
          columns={[
            { id: "title", label: "Título" },
            { id: "skill", label: "Habilidade" },
            { id: "response", label: "Resposta" },
            { id: "stimulus", label: "Estímulo" },
            { id: "status", label: "Situação" },
            { id: "cohorts", label: "Turmas" },
            { id: "attempts", label: "Respostas" },
            { id: "action", label: "Ações" },
          ]}
          rows={items.map((item) => {
            const response =
              item.responseType && isResponseType(item.responseType)
                ? RESPONSE_LABELS[item.responseType]
                : "Formato anterior";
            const stimulus =
              item.stimulusType && isStimulusType(item.stimulusType)
                ? STIMULUS_LABELS[item.stimulusType]
                : "—";
            const published = item.publicationStatus === "PUBLISHED";
            const status = (
              <Badge tone={published ? "success" : "neutral"}>
                {published ? "Publicada" : "Rascunho"}
              </Badge>
            );
            const attempts = item.hasAttempts ? "Com respostas" : "Sem respostas";
            const cohorts = `${item.assignmentCount} ${item.assignmentCount === 1 ? "turma" : "turmas"}`;
            const actions = (
              <span className={styles.builderActions}>
                <Link href={`/teacher/praticas/${item.id}`}>
                  {published || item.hasAttempts ? "Ver" : "Editar"}
                </Link>
                <form action={duplicatePracticeAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Duplicar
                  </Button>
                </form>
              </span>
            );
            return {
              id: item.id,
              cells: [
                <Link key="t" href={`/teacher/praticas/${item.id}`}>
                  {item.title}
                </Link>,
                SKILL_LABELS[item.skill],
                response,
                stimulus,
                status,
                cohorts,
                attempts,
                actions,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>{item.title}</h2>
                  <div className="yas-row-summary-meta">
                    {status}
                    <span>{SKILL_LABELS[item.skill]}</span>
                    <span>{response}</span>
                    <span>{stimulus}</span>
                    <span>{cohorts}</span>
                    <span>{attempts}</span>
                  </div>
                  {actions}
                </article>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
