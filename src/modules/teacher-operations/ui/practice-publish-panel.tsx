"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Badge, Button, Checkbox, Input, type ButtonVariant } from "@/components/ui";

import type { PublicationReport } from "./practice-builder-logic";
import styles from "./teacher-operations.module.css";

type FormAction = (form: FormData) => Promise<void>;

export interface PublishPanelProps {
  practiceId: string | null;
  published: boolean;
  hasAttempts: boolean;
  dirty: boolean;
  report: PublicationReport;
  cohorts: { id: string; name: string }[];
  assignments: { cohortId: string; cohortName: string; dueAt: string | null }[];
  actions: {
    publish: FormAction;
    unpublish: FormAction;
    duplicate: FormAction;
    assign: FormAction;
    unassign: FormAction;
  };
}

function PendingButton({
  children,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} disabled={disabled}>
      {children}
    </Button>
  );
}

function formatDue(value: string | null): string {
  if (!value) return "Sem prazo";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function PracticePublishPanel({
  practiceId,
  published,
  hasAttempts,
  dirty,
  report,
  cohorts,
  assignments,
  actions,
}: PublishPanelProps) {
  const [assignError, setAssignError] = useState<string | null>(null);
  const assigned = new Set(assignments.map((item) => item.cohortId));

  function validateAssign(event: FormEvent<HTMLFormElement>) {
    if (new FormData(event.currentTarget).getAll("cohortIds").length === 0) {
      event.preventDefault();
      setAssignError("Escolha ao menos uma turma.");
    } else setAssignError(null);
  }

  return (
    <div className={styles.builderStack}>
      <section aria-labelledby="practice-checklist">
        <h3 id="practice-checklist" className={styles.builderSubheading}>
          Checklist de publicação
        </h3>
        {report.ok ? (
          <Alert
            tone="success"
            title="Pronta para publicar"
            description="Todos os itens obrigatórios estão completos."
          />
        ) : (
          <>
            <Alert
              tone="warning"
              title="Ainda faltam itens"
              description="Resolva os pontos abaixo antes de publicar."
            />
            <ul className={styles.builderList}>
              {report.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </>
        )}
        {report.warnings.length > 0 && (
          <ul className={styles.builderList}>
            {report.warnings.map((warning) => (
              <li key={warning}>Recomendação: {warning}</li>
            ))}
          </ul>
        )}
      </section>

      {!practiceId && (
        <Alert
          tone="info"
          title="Salve o rascunho primeiro"
          description="Só é possível publicar e atribuir uma prática já salva."
        />
      )}

      {practiceId && !published && (
        <form action={actions.publish} className={styles.builderStack}>
          <input type="hidden" name="id" value={practiceId} />
          {dirty && (
            <Alert
              tone="warning"
              title="Há alterações não salvas"
              description="Salve o rascunho para publicar a versão que você está vendo."
            />
          )}
          <div>
            <PendingButton disabled={!report.ok || dirty}>Publicar prática</PendingButton>
          </div>
        </form>
      )}

      {practiceId && published && (
        <>
          <section aria-labelledby="practice-assign" className={styles.builderStack}>
            <h3 id="practice-assign" className={styles.builderSubheading}>
              Atribuir às turmas
            </h3>
            {cohorts.length === 0 ? (
              <Alert
                tone="warning"
                title="Nenhuma turma ativa neste curso"
                description="Você só atribui a turmas ativas suas do mesmo curso da prática."
              />
            ) : (
              <form
                action={actions.assign}
                onSubmit={validateAssign}
                className={styles.builderStack}
                noValidate
              >
                <input type="hidden" name="id" value={practiceId} />
                <fieldset className={styles.builderFieldset}>
                  <legend>Turmas (escolha uma ou mais)</legend>
                  {cohorts.map((cohort) => (
                    <Checkbox
                      key={cohort.id}
                      name="cohortIds"
                      value={cohort.id}
                      label={
                        assigned.has(cohort.id) ? `${cohort.name} (já atribuída)` : cohort.name
                      }
                    />
                  ))}
                  {assignError && <Alert tone="error" title={assignError} />}
                </fieldset>
                <Input
                  type="datetime-local"
                  name="dueAt"
                  label="Prazo (opcional)"
                  message="Horário de Recife (America/Recife, UTC-03:00). Precisa ser uma data futura."
                />
                <div>
                  <PendingButton>Atribuir prática</PendingButton>
                </div>
              </form>
            )}
          </section>

          <section aria-labelledby="practice-assigned" className={styles.builderStack}>
            <h3 id="practice-assigned" className={styles.builderSubheading}>
              Turmas atribuídas
            </h3>
            {assignments.length === 0 ? (
              <p className={styles.muted}>Nenhuma turma recebeu esta prática ainda.</p>
            ) : (
              <ul className={styles.builderList}>
                {assignments.map((item) => (
                  <li key={item.cohortId} className={styles.builderRow}>
                    <span>
                      <strong>{item.cohortName}</strong> · Prazo: {formatDue(item.dueAt)}
                    </span>
                    <form action={actions.unassign}>
                      <input type="hidden" name="id" value={practiceId} />
                      <input type="hidden" name="cohortId" value={item.cohortId} />
                      <PendingButton variant="outline">Remover {item.cohortName}</PendingButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="practice-state" className={styles.builderStack}>
            <h3 id="practice-state" className={styles.builderSubheading}>
              Situação
            </h3>
            <p>
              <Badge tone="success">Publicada</Badge>{" "}
              {hasAttempts
                ? "Já tem respostas de alunos: o conteúdo não pode mais ser editado."
                : "O conteúdo está somente leitura. Despublique para editar."}
            </p>
            <div className={styles.builderActions}>
              {hasAttempts && (
                <form action={actions.duplicate}>
                  <input type="hidden" name="id" value={practiceId} />
                  <PendingButton>Duplicar para editar</PendingButton>
                </form>
              )}
              <form action={actions.unpublish}>
                <input type="hidden" name="id" value={practiceId} />
                <PendingButton variant="outline">Despublicar</PendingButton>
              </form>
            </div>
          </section>
        </>
      )}

      {practiceId && !published && hasAttempts && (
        <form action={actions.duplicate}>
          <input type="hidden" name="id" value={practiceId} />
          <PendingButton variant="outline">Duplicar para editar</PendingButton>
        </form>
      )}
    </div>
  );
}
