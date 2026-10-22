"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { localAvailabilityToIso } from "../domain/availability-time";
import {
  localParts,
  safeSessionReturn,
  type SessionWorkspace,
  type WorkspaceSession,
  type SessionMutationResult,
} from "../domain/session-workspace";
import { teacherSessionTypeLabel } from "../domain/models";
import styles from "./sessions.module.css";

export function SessionForm({
  context,
  action,
  session,
  prefill,
  returnTo = "/teacher/sessoes",
  onSaved,
  onDirtyChange,
}: {
  context: SessionWorkspace;
  action: (form: FormData) => Promise<SessionMutationResult>;
  session?: WorkspaceSession;
  prefill?: { start?: string | undefined; end?: string | undefined };
  returnTo?: string;
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0),
    [dirty, setDirty] = useState(false),
    [pending, startTransition] = useTransition();
  const initialStart = session?.starts_at ?? prefill?.start,
    initialEnd = session?.ends_at ?? prefill?.end;
  const [values, setValues] = useState({
    title: session?.title ?? "",
    session_type: session?.session_type ?? "CORE_CLASS",
    session_date: initialStart ? localParts(initialStart).date : "",
    end_date: initialEnd ? localParts(initialEnd).date : "",
    start_time: initialStart ? localParts(initialStart).time : "",
    end_time: initialEnd ? localParts(initialEnd).time : "",
    capacity: String(session?.capacity ?? 6),
    cohort_id: session?.cohort_id ?? "",
    target_student_user_id: session?.target_student_user_id ?? "",
    meeting_url: "",
  });
  const [result, setResult] = useState<SessionMutationResult | null>(null);
  const locked = session?.has_bookings ?? false,
    privateSession = values.session_type === "PRIVATE_SESSION";
  const back = safeSessionReturn(returnTo);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const leave = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Descartar as alterações não salvas desta sessão?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  const update = (key: keyof typeof values, value: string) => {
    setDirty(true);
    onDirtyChange?.(true);
    setValues((old) => ({
      ...old,
      [key]: value,
      ...(key === "session_date" && (old.end_date === old.session_date || !old.end_date)
        ? { end_date: value }
        : {}),
      ...(key === "session_type"
        ? {
            cohort_id: "",
            target_student_user_id: "",
            capacity: value === "PRIVATE_SESSION" ? "1" : "6",
          }
        : {}),
    }));
    setResult(null);
  };
  const fieldError = (key: string) => (result && !result.ok ? result.fields?.[key] : undefined);
  let scheduleMessage = "Escolha data e horários para conferir sua disponibilidade.";
  try {
    const start = Date.parse(localAvailabilityToIso(values.session_date, values.start_time)),
      end = Date.parse(
        localAvailabilityToIso(values.end_date || values.session_date, values.end_time),
      );
    if (end <= start) scheduleMessage = "O término deve ser após o início.";
    else if (
      !context.availability.some(
        (a) => Date.parse(a.starts_at) <= start && Date.parse(a.ends_at) >= end,
      )
    )
      scheduleMessage = "Este horário está fora da disponibilidade cadastrada.";
    else if (
      context.sessions.some(
        (s) =>
          s.id !== session?.id &&
          s.status === "SCHEDULED" &&
          Date.parse(s.starts_at) < end &&
          Date.parse(s.ends_at) > start,
      )
    )
      scheduleMessage = "Há outra sessão neste horário.";
    else
      scheduleMessage =
        "Horário compatível com os dados carregados. A disponibilidade será confirmada ao salvar.";
  } catch {
    /* Incomplete fields are explained above. */
  }
  const changeStep = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => stepRef.current?.focus());
  };
  const submit = () => {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const response = await action(data);
        setResult(response);
        if (response.ok) {
          setDirty(false);
          onDirtyChange?.(false);
          if (onSaved) {
            onSaved();
            router.refresh();
          } else
            router.push(
              `/teacher/sessoes/${response.sessionId}?save=success&returnTo=${encodeURIComponent(back)}`,
            );
        } else {
          setStep(0);
          requestAnimationFrame(() => stepRef.current?.focus());
        }
      } catch {
        setResult({
          ok: false,
          message: "Não foi possível salvar. Seus dados foram mantidos. Tente novamente.",
        });
      }
    });
  };
  const labels = ["Informações da sessão", "Turma/aluno e sala", "Revisão"];
  return (
    <div className={session ? styles.stack : styles.wizard}>
      {!session && (
        <ol className={styles.steps} aria-label="Etapas da criação">
          {labels.map((label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      )}
      <Card>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (session || step === 2) submit();
            else if (formRef.current?.reportValidity()) changeStep(step + 1);
          }}
          className={styles.stack}
        >
          <h2 ref={stepRef} tabIndex={-1}>
            {session ? "Editar sessão" : labels[step]}
          </h2>
          {result && !result.ok && (
            <Alert tone="error" title="Sessão não salva" description={result.message} />
          )}
          {session && <input type="hidden" name="id" value={session.id} />}
          <div hidden={!session && step !== 0} className={styles.stack}>
            <Input
              label="Título da sessão"
              name="title"
              required
              maxLength={200}
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              tone={fieldError("title") ? "error" : "default"}
              message={fieldError("title") ?? ""}
            />
            <Select
              label="Tipo de sessão"
              name="session_type"
              value={values.session_type}
              disabled={Boolean(session)}
              onChange={(e) => update("session_type", e.target.value)}
              options={[
                { value: "CORE_CLASS", label: "Core Class" },
                { value: "CONVERSATION_LAB", label: "Conversation Lab" },
                { value: "PRIVATE_SESSION", label: "Sessão particular" },
              ]}
            />
            {session && <input type="hidden" name="session_type" value={values.session_type} />}
            <div className={styles.fields}>
              <Input
                label="Data"
                name="session_date"
                type="date"
                required
                value={values.session_date}
                readOnly={locked}
                message={fieldError("session_date") ?? ""}
                onChange={(e) => update("session_date", e.target.value)}
              />
              <Input
                label="Início"
                name="start_time"
                type="time"
                required
                value={values.start_time}
                readOnly={locked}
                onChange={(e) => update("start_time", e.target.value)}
                message={fieldError("start_time") ?? ""}
              />
              <Input
                label="Data de término"
                name="end_date"
                type="date"
                required
                value={values.end_date}
                readOnly={locked}
                onChange={(e) => update("end_date", e.target.value)}
              />
              <Input
                label="Término"
                name="end_time"
                type="time"
                required
                value={values.end_time}
                readOnly={locked}
                message={fieldError("end_time") ?? ""}
                onChange={(e) => update("end_time", e.target.value)}
              />
            </div>
            <p className={styles.muted}>Fuso: America/Recife</p>
            <p role="status" className={styles.notice}>
              {scheduleMessage}
            </p>
          </div>
          <div hidden={!session && step !== 1} className={styles.stack}>
            <Select
              label={privateSession ? "Aluno" : "Turma"}
              name={privateSession ? "target_student_user_id" : "cohort_id"}
              required={Boolean(session) || step === 1}
              disabled={locked}
              value={privateSession ? values.target_student_user_id : values.cohort_id}
              message={fieldError(privateSession ? "target_student_user_id" : "cohort_id") ?? ""}
              onChange={(e) =>
                update(privateSession ? "target_student_user_id" : "cohort_id", e.target.value)
              }
              options={[
                { value: "", label: privateSession ? "Selecione um aluno" : "Selecione uma turma" },
                ...(privateSession ? context.students : context.cohorts).map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
            />
            {locked && (
              <input
                type="hidden"
                name={privateSession ? "target_student_user_id" : "cohort_id"}
                value={privateSession ? values.target_student_user_id : values.cohort_id}
              />
            )}
            <Input
              label="Capacidade"
              name="capacity"
              type="number"
              min={1}
              max={6}
              required
              value={values.capacity}
              readOnly={locked || privateSession}
              message={fieldError("capacity") ?? ""}
              onChange={(e) => update("capacity", e.target.value)}
            />
            <p className={styles.muted}>
              A criação não reserva vagas nem envia convites automaticamente.
            </p>
            <Input
              label="Link do Google Meet (opcional)"
              name="meeting_url"
              type="url"
              maxLength={2048}
              placeholder="https://meet.google.com/abc-defg-hij"
              value={values.meeting_url}
              onChange={(e) => update("meeting_url", e.target.value)}
              message={
                fieldError("meeting_url") ??
                (session
                  ? "Deixe vazio para preservar o link existente."
                  : "Crie a sala no Google Meet e cole o link aqui.")
              }
            />
            {locked && (
              <p className={styles.notice}>
                Há reservas: alterações de horário ou estrutura exigem cancelar e criar outra
                sessão.
              </p>
            )}
          </div>
          {!session && step === 2 && (
            <p>
              Confira o resumo antes de criar. A disponibilidade e os vínculos serão validados
              novamente no servidor.
            </p>
          )}
          <div className={styles.actions}>
            {!session && step > 0 && (
              <Button onClick={() => changeStep(step - 1)} disabled={pending}>
                Voltar
              </Button>
            )}
            {!session && (
              <Link href={back} className="yas-button yas-button--soft">
                Cancelar
              </Link>
            )}
            <Button variant="primary" type="submit" loading={pending}>
              {session ? "Salvar encontro" : step === 2 ? "Criar sessão" : "Continuar"}
            </Button>
          </div>
        </form>
      </Card>
      {!session && (
        <Card className={styles.summary}>
          <h2>Resumo da sessão</h2>
          <strong>{values.title || "Título da sessão"}</strong>
          <p>{teacherSessionTypeLabel(values.session_type as WorkspaceSession["session_type"])}</p>
          <p>
            {values.session_date || "Data a definir"} · {values.start_time || "--:--"} –{" "}
            {values.end_date !== values.session_date ? `${values.end_date} ` : ""}
            {values.end_time || "--:--"}
          </p>
          <p>America/Recife · Online</p>
          <p>
            {(privateSession ? context.students : context.cohorts).find(
              (c) => c.id === (privateSession ? values.target_student_user_id : values.cohort_id),
            )?.name ?? "Turma/aluno a definir"}
          </p>
          <p>Capacidade: {values.capacity}</p>
        </Card>
      )}
    </div>
  );
}
