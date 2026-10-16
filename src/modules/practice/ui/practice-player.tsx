"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Alert, Badge, Button, Icon } from "@/components/ui";

import {
  previewGrade,
  type PracticeContentV2,
  type PracticeFeedbackV2,
  type PracticeResponseInputV2,
} from "../domain/content-v2";
import { AudioResponse } from "./audio-response";
import {
  buildResponseInput,
  initialAnswerState,
  type PlayerAnswerState,
  type PlayerOutcome,
} from "./practice-player-logic";
import { PracticeResponseFields } from "./practice-response-fields";
import { PracticeResultHero } from "./practice-result";
import { PracticeStimulus } from "./practice-stimulus";

export type { PlayerOutcome as PracticePlayerOutcome } from "./practice-player-logic";

/** Audio upload wiring for SPOKEN in `live` mode (same flow as legacy MANUAL_AUDIO). */
export interface PracticePlayerSpokenFlow {
  attemptId: string;
  upload: (id: string, mime: string) => Promise<{ mediaId: string; uploadUrl: string }>;
  complete: (id: string) => Promise<void>;
}

export interface PracticePlayerProps {
  /** Student-safe v2 content (no answer key). The Student read model satisfies this type. */
  content: PracticeContentV2;
  /** `live` persists through `onSubmit`; `preview` never calls it (Teacher builder). */
  mode: "live" | "preview";
  /** Short-lived signed URL for IMAGE/AUDIO/VIDEO stimuli, minted on the server. */
  stimulusUrl?: string | null | undefined;
  /** Required in `live` mode. Resolve with the grading outcome; reject to show a retryable error. */
  onSubmit?: ((response: PracticeResponseInputV2) => Promise<PlayerOutcome>) | undefined;
  /** Required in `live` mode for SPOKEN responses. */
  spoken?: PracticePlayerSpokenFlow | undefined;
  /** `preview` only: Teacher answer key used by `previewGrade`. Never pass it in `live` mode. */
  answerKey?: unknown;
  /** `preview` only: authored feedback shown after grading. */
  previewFeedback?: PracticeFeedbackV2 | undefined;
  /** Rendered under the result (for example a link back to the practice list). */
  resultFooter?: ReactNode;
}

type Phase =
  | { name: "answering"; message: string | null }
  | { name: "submitting" }
  | { name: "done"; outcome: PlayerOutcome; preview: boolean };

function ResultPanel({
  outcome,
  preview,
  onRetry,
  footer,
}: {
  outcome: PlayerOutcome;
  preview: boolean;
  onRetry: (() => void) | null;
  footer: ReactNode;
}) {
  return (
    <div className="yas-practice-result" aria-live="polite">
      {preview && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
      <PracticeResultHero status={outcome.status} feedback={outcome.feedback}>
        {(onRetry || footer) && (
          <div className="yas-practice-outcome-actions">
            {onRetry && (
              <Button type="button" variant="outline" onClick={onRetry}>
                Tentar de novo
              </Button>
            )}
            {footer}
          </div>
        )}
      </PracticeResultHero>
    </div>
  );
}

export function PracticePlayer({
  content,
  mode,
  stimulusUrl,
  onSubmit,
  spoken,
  answerKey,
  previewFeedback,
  resultFooter,
}: PracticePlayerProps) {
  const { response } = content;
  const preview = mode === "preview";
  const [state, setState] = useState<PlayerAnswerState>(() => initialAnswerState(response));
  const [phase, setPhase] = useState<Phase>({ name: "answering", message: null });
  const busy = phase.name === "submitting";

  async function send(input: PracticeResponseInputV2) {
    if (preview) {
      const graded = previewGrade(content, answerKey, input);
      if (graded.status === "INVALID") {
        setPhase({ name: "answering", message: graded.reason });
        return;
      }
      const outcome: PlayerOutcome =
        graded.status === "MANUAL"
          ? { status: "PENDING_MANUAL", feedback: null }
          : {
              status: graded.status,
              feedback:
                (graded.status === "CORRECT"
                  ? previewFeedback?.correct
                  : previewFeedback?.incorrect) ?? null,
            };
      setPhase({ name: "done", outcome, preview: true });
      return;
    }
    if (!onSubmit) {
      setPhase({ name: "answering", message: "Envio indisponível nesta tela." });
      return;
    }
    setPhase({ name: "submitting" });
    try {
      const outcome = await onSubmit(input);
      setPhase({ name: "done", outcome, preview: false });
    } catch {
      setPhase({
        name: "answering",
        message: "Não foi possível enviar sua resposta. Confira sua conexão e tente de novo.",
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (response.type === "SPOKEN") {
      if (preview) {
        void send({ mediaId: "preview" });
        return;
      }
      const mediaId = new FormData(event.currentTarget).get("mediaId");
      if (typeof mediaId === "string" && mediaId) void send({ mediaId });
      else setPhase({ name: "answering", message: "Envie seu áudio antes de enviar a resposta." });
      return;
    }
    const input = buildResponseInput(response, state);
    if (!input) {
      setPhase({ name: "answering", message: "Responda a atividade antes de enviar." });
      return;
    }
    void send(input);
  }

  function retry() {
    setState(initialAnswerState(response));
    setPhase({ name: "answering", message: null });
  }

  if (phase.name === "done") {
    return (
      <div className="yas-practice-player">
        <ResultPanel
          outcome={phase.outcome}
          preview={phase.preview}
          onRetry={preview ? retry : null}
          footer={resultFooter}
        />
      </div>
    );
  }

  return (
    <div className="yas-practice-player">
      <PracticeStimulus stimulus={content.stimulus} url={stimulusUrl} />
      <form
        className="yas-practice-response-form"
        onSubmit={handleSubmit}
        aria-busy={busy || undefined}
        noValidate
      >
        {/* Resposta falada: o gravador já guia a tarefa, sem instrução repetida. */}
        {content.instructions && response.type !== "SPOKEN" && (
          <p className="yas-practice-instructions">
            <Icon name="spark" size={16} />
            {content.instructions}
          </p>
        )}

        {response.type === "SPOKEN" ? (
          spoken && !preview ? (
            <AudioResponse
              attemptId={spoken.attemptId}
              upload={spoken.upload}
              complete={spoken.complete}
            />
          ) : (
            <Alert
              tone="info"
              title="Resposta falada"
              description="Na atividade real o aluno grava ou envia um áudio. A gravação não funciona na prévia."
            />
          )
        ) : (
          <PracticeResponseFields
            response={response}
            state={state}
            onChange={setState}
            disabled={busy}
          />
        )}

        {phase.name === "answering" && phase.message && (
          <Alert tone="error" title={phase.message} />
        )}

        {response.type === "SPOKEN" && !preview ? null : (
          <div className="yas-practice-actions">
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              loading={busy}
              leadingIcon={<Icon name="check" size={18} strokeWidth={2.6} />}
            >
              {preview ? "Testar resposta" : "Enviar resposta"}
            </Button>
            {busy && (
              <span className="yas-practice-visually-hidden" role="status">
                Enviando sua resposta…
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
