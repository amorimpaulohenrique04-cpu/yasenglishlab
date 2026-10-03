"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, ProgressBar, Select, Textarea, SectionHeader } from "@/components/ui";
import type { AssessmentExecution } from "@/modules/assessments";
import {
  saveAssessmentAnswerAction,
  submitAssessmentAction,
} from "@/app/(protected)/(student)/onboarding/actions";
export function AssessmentRunner({ execution }: { execution: AssessmentExecution }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(execution.responses.map((r) => [r.itemId, r.response])),
  );
  const [saveStatus, setSaveStatus] = useState("Respostas salvas");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft = useRef<{ itemId: string; response: Record<string, unknown> } | null>(null);
  const item = execution.items[index];
  function enqueue(itemId: string, response: Record<string, unknown>) {
    pending.current++;
    setSaveStatus("Salvando resposta…");
    queue.current = queue.current.then(async () => {
      const result = await saveAssessmentAnswerAction({
        attemptId: execution.attemptId,
        itemId,
        response,
      }).catch(() => ({ ok: false }));
      pending.current--;
      if (!result.ok) {
        failed.current = true;
        setError(true);
        setSaveStatus("Resposta não salva. Tente novamente.");
      } else if (pending.current === 0 && !failed.current) {
        setSaveStatus("Respostas salvas");
      }
    });
  }
  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (draft.current) {
      enqueue(draft.current.itemId, draft.current.response);
      draft.current = null;
    }
  }
  function change(response: Record<string, unknown>) {
    if (!item) return;
    setAnswers((a) => ({ ...a, [item.id]: response }));
    failed.current = false;
    setError(false);
    setSaveStatus("Resposta aguardando salvamento…");
    draft.current = { itemId: item.id, response };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function navigate(next: number) {
    flush();
    setBusy(true);
    await queue.current;
    setBusy(false);
    if (!failed.current) setIndex(next);
  }
  async function submit() {
    flush();
    setBusy(true);
    await queue.current;
    if (failed.current) {
      setBusy(false);
      return;
    }
    const result = await submitAssessmentAction(execution.attemptId).catch(() => ({ ok: false }));
    setBusy(false);
    if (result.ok) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setError(true);
      setSaveStatus("Não foi possível concluir. Responda e salve todos os itens.");
    }
  }
  if (!item)
    return (
      <Alert
        tone="error"
        title="Teste indisponível"
        description="Nenhum item executável foi carregado."
      />
    );
  return (
    <Card className="yas-stack">
      <ProgressBar
        value={Math.round(((index + 1) / execution.items.length) * 100)}
        label={`Item ${index + 1} de ${execution.items.length}`}
      />
      <SectionHeader title={item.prompt.prompt} />
      {item.itemType === "MULTIPLE_CHOICE" ? (
        <Select
          label="Sua resposta"
          tone={error ? "error" : "default"}
          message={error ? "Confira sua resposta e tente salvar novamente." : undefined}
          value={String(answers[item.id]?.optionId ?? "")}
          options={[
            { value: "", label: "Selecione uma opção" },
            ...item.prompt.options.map((o) => ({ value: o.id, label: o.label })),
          ]}
          onChange={(e) => {
            if (e.target.value) change({ optionId: e.target.value });
          }}
          disabled={busy}
        />
      ) : (
        <>
          <p>{item.prompt.instructions}</p>
          <Textarea
            label="Sua resposta"
            tone={error ? "error" : "default"}
            message={error ? "Confira sua resposta e tente salvar novamente." : undefined}
            maxLength={4000}
            value={String(answers[item.id]?.text ?? "")}
            onChange={(e) => change({ text: e.target.value })}
            onBlur={flush}
            disabled={busy}
          />
        </>
      )}
      <p role="status" aria-live="polite">
        {saveStatus}
      </p>
      {error && (
        <Alert
          tone="error"
          title="Sua resposta precisa de atenção"
          description="Confira o campo e tente salvar novamente. Não saia antes da confirmação."
        />
      )}
      {error && (
        <Button
          onClick={() => {
            failed.current = false;
            setError(false);
            enqueue(item.id, answers[item.id] ?? {});
          }}
        >
          Tentar salvar novamente
        </Button>
      )}
      <div className="yas-stack">
        <Button disabled={busy || index === 0} onClick={() => navigate(index - 1)}>
          Item anterior
        </Button>
        {index < execution.items.length - 1 ? (
          <Button variant="primary" loading={busy} onClick={() => navigate(index + 1)}>
            Próximo item
          </Button>
        ) : (
          <Button variant="primary" loading={busy} onClick={submit}>
            Concluir teste
          </Button>
        )}
      </div>
    </Card>
  );
}
