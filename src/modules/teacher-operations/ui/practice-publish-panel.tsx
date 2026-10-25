"use client";

import { useFormStatus } from "react-dom";
import { Alert, Badge, Button, Icon } from "@/components/ui";
import type { PublicationReport } from "./practice-builder-logic";
import styles from "./practices.module.css";

type FormAction = (form: FormData) => Promise<void>;
export interface PublishSummary {
  infoOk: boolean;
  questionCount: number;
  issueCount: number;
  mediaCount: number;
  minutes: string;
  skillLabel: string;
  level: string;
}
export interface PublishPanelProps {
  practiceId: string | null;
  published: boolean;
  hasAttempts: boolean;
  dirty: boolean;
  report: PublicationReport;
  summary: PublishSummary;
  lessonTitle: string;
  onEditInformation: () => void;
  onEditQuestions: () => void;
  actions: { unpublish: FormAction; duplicate: FormAction };
}
function SubmitButton({
  children,
  disabled = false,
  outline = false,
  describedBy,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  outline?: boolean;
  describedBy?: string | undefined;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={outline ? "outline" : "secondary"}
      loading={pending}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      {children}
    </Button>
  );
}

/** Primary publish CTA rendered in the builder footer; keeps the existing publish action and its guards. */
export function PracticePublishFooterAction({
  practiceId,
  published,
  hasAttempts,
  dirty,
  reportOk,
  publish,
}: {
  practiceId: string | null;
  published: boolean;
  hasAttempts: boolean;
  dirty: boolean;
  reportOk: boolean;
  publish: FormAction;
}) {
  if (!practiceId || published) return null;
  const reason = hasAttempts
    ? "Esta prática já tem respostas."
    : dirty
      ? "Salve o rascunho antes de publicar."
      : !reportOk
        ? "Resolva as pendências da revisão para publicar."
        : "";
  return (
    <>
      {reason && (
        <span id="practice-publish-reason" className={styles.footerHint}>
          {reason}
        </span>
      )}
      <form action={publish}>
        <input type="hidden" name="id" value={practiceId} />
        <SubmitButton
          disabled={Boolean(reason)}
          describedBy={reason ? "practice-publish-reason" : undefined}
        >
          Publicar prática
        </SubmitButton>
      </form>
    </>
  );
}

function CheckRow({
  tone,
  icon,
  title,
  detail,
  action,
}: {
  tone: "ok" | "warn" | "info";
  icon: "check" | "alert" | "lock";
  title: string;
  detail: string;
  action?: { label: string; onClick: () => void; ariaLabel: string };
}) {
  return (
    <div className={styles.checkRow}>
      <span className={styles.checkIcon} data-tone={tone} aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {action && (
        <Button
          type="button"
          variant="ghost"
          aria-label={action.ariaLabel}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function PracticePublishPanel({
  practiceId,
  published,
  hasAttempts,
  report,
  summary,
  lessonTitle,
  dirty,
  onEditInformation,
  onEditQuestions,
  actions,
}: PublishPanelProps) {
  const questionsOk = summary.issueCount === 0;
  const config = [
    `Duração estimada: ${summary.minutes || "?"} min`,
    summary.skillLabel,
    summary.level,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={styles.publishGrid}>
      <section className={styles.panel}>
        <h3>Revisão da prática</h3>
        <p>Verifique se está tudo certo antes de publicar.</p>
        <div className={styles.checklist}>
          <CheckRow
            tone={summary.infoOk ? "ok" : "warn"}
            icon={summary.infoOk ? "check" : "alert"}
            title="Informações gerais"
            detail={
              summary.infoOk
                ? "Título, objetivo e aula preenchidos"
                : "Faltam título, objetivo ou aula"
            }
            action={{
              label: "Editar",
              onClick: onEditInformation,
              ariaLabel: "Editar informações gerais",
            }}
          />
          <CheckRow
            tone={questionsOk ? "ok" : "warn"}
            icon={questionsOk ? "check" : "alert"}
            title={`Questões (${summary.questionCount})`}
            detail={
              questionsOk
                ? "Todas as questões estão completas"
                : `${summary.issueCount} ${summary.issueCount === 1 ? "pendência" : "pendências"}`
            }
            action={{ label: "Revisar", onClick: onEditQuestions, ariaLabel: "Revisar questões" }}
          />
          <CheckRow
            tone="ok"
            icon="check"
            title="Mídias e recursos"
            detail={
              summary.mediaCount > 0
                ? `${summary.mediaCount} ${summary.mediaCount === 1 ? "questão com mídia" : "questões com mídia"}`
                : "Sem mídia"
            }
            action={{
              label: "Revisar",
              onClick: onEditQuestions,
              ariaLabel: "Revisar mídias e recursos",
            }}
          />
          <CheckRow
            tone="ok"
            icon="check"
            title="Configurações"
            detail={config}
            action={{
              label: "Editar",
              onClick: onEditInformation,
              ariaLabel: "Editar configurações",
            }}
          />
          <CheckRow
            tone="info"
            icon="lock"
            title="Uma tentativa por aluno"
            detail="Correção disponível após o envio final"
          />
        </div>
        {report.issues.length > 0 && (
          <>
            <Alert tone="warning" title="Ainda faltam itens" />
            <ul>
              {report.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </>
        )}
        {report.warnings.length > 0 && (
          <ul>
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        {report.ok && (
          <Alert
            tone="success"
            title="Pronta para publicar"
            description="Todos os itens obrigatórios estão completos."
          />
        )}
      </section>
      <section className={styles.panel}>
        <h3>Publicar na aula</h3>
        <p>Disponível para quem tiver acesso à aula.</p>
        <div className={styles.destination}>
          <Icon name="book" />
          <strong>{lessonTitle}</strong>
          <Badge tone="info">Acesso herdado da aula</Badge>
        </div>
        <p>O público, a sequência e a data de liberação seguem a configuração da aula.</p>
        {dirty && (
          <Alert
            tone="warning"
            title="Há alterações não salvas"
            description="Salve o rascunho antes de publicar."
          />
        )}
        {!practiceId && <Alert tone="info" title="Salve o rascunho primeiro" />}
        <div className={styles.publishActions}>
          {practiceId && published && (
            <form action={actions.unpublish}>
              <input type="hidden" name="id" value={practiceId} />
              <SubmitButton outline>Despublicar</SubmitButton>
            </form>
          )}
          {practiceId && (
            <form action={actions.duplicate}>
              <input type="hidden" name="id" value={practiceId} />
              <SubmitButton outline>
                {hasAttempts ? "Duplicar para editar" : "Duplicar prática"}
              </SubmitButton>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
