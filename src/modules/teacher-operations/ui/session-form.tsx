"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Icon, Input, Select, Stepper, type IconName } from "@/components/ui";
import { yasTokens } from "@/styles/tokens";
import { localAvailabilityToIso } from "../domain/availability-time";
import {
  addDays,
  availableSuggestions,
  localParts,
  safeSessionReturn,
  type SessionWorkspace,
  type WorkspaceSession,
  type SessionMutationResult,
} from "../domain/session-workspace";
import { formatDay, formatDuration, relativeDayLabel } from "../domain/session-calendar";
import { teacherSessionTypeLabel } from "../domain/models";
import { sessionTypeMeta } from "./session-bits";
import styles from "./sessions.module.css";

type Values = {
  title: string;
  session_type: string;
  session_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  capacity: string;
  cohort_id: string;
  target_student_user_id: string;
  meeting_url: string;
};

type Schedule = {
  state: "idle" | "invalid" | "outside" | "conflict" | "ok";
  text: string;
  minutes: number | null;
};

const TITLE_MAX = 200;
const MEET_PATTERN = /^https:\/\/meet\.google\.com\/[A-Za-z0-9-]+\/?$/;
const creatableTypes = ["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION"] as const;
const steps = [
  { label: "Informações da sessão", description: "Título, tipo, data e horário." },
  { label: "Turma e sala", description: "Participantes, vagas e link do Meet." },
  { label: "Revisão", description: "Confira tudo antes de criar." },
];
const scheduleIcon: Record<Schedule["state"], IconName> = {
  idle: "clock",
  invalid: "alert",
  outside: "alert",
  conflict: "x-c",
  ok: "check-c",
};

function evaluateSchedule(values: Values, context: SessionWorkspace, sessionId?: string): Schedule {
  try {
    const start = Date.parse(localAvailabilityToIso(values.session_date, values.start_time)),
      end = Date.parse(
        localAvailabilityToIso(values.end_date || values.session_date, values.end_time),
      );
    const minutes = Math.round((end - start) / 60000);
    if (end <= start)
      return { state: "invalid", text: "O término deve ser após o início.", minutes: null };
    if (
      !context.availability.some(
        (a) => Date.parse(a.starts_at) <= start && Date.parse(a.ends_at) >= end,
      )
    )
      return {
        state: "outside",
        text: "Este horário está fora da disponibilidade cadastrada.",
        minutes,
      };
    if (
      context.sessions.some(
        (s) =>
          s.id !== sessionId &&
          s.status === "SCHEDULED" &&
          Date.parse(s.starts_at) < end &&
          Date.parse(s.ends_at) > start,
      )
    )
      return { state: "conflict", text: "Há outra sessão neste horário.", minutes };
    return {
      state: "ok",
      text: "Horário compatível com os dados carregados. A disponibilidade será confirmada ao salvar.",
      minutes,
    };
  } catch {
    return {
      state: "idle",
      text: "Escolha data e horários para conferir sua disponibilidade.",
      minutes: null,
    };
  }
}

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
    [direction, setDirection] = useState<"forward" | "back">("forward"),
    [dirty, setDirty] = useState(false),
    [loadedAt] = useState(() => Date.now()),
    [pending, startTransition] = useTransition();
  const initialStart = session?.starts_at ?? prefill?.start,
    initialEnd = session?.ends_at ?? prefill?.end;
  const [values, setValues] = useState<Values>({
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
  const editing = Boolean(session);
  const locked = session?.has_bookings ?? false,
    privateSession = values.session_type === "PRIVATE_SESSION";
  const back = safeSessionReturn(returnTo);
  const schedule = evaluateSchedule(values, context, session?.id);
  const meetUrl = values.meeting_url.trim();

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const leave = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.getAttribute("href")?.startsWith("#")) return;
      if (anchor.getAttribute("target") === "_blank") return;
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

  const update = (patch: Partial<Values>) => {
    setDirty(true);
    onDirtyChange?.(true);
    setValues((old) => ({
      ...old,
      ...patch,
      ...("session_date" in patch && (old.end_date === old.session_date || !old.end_date)
        ? { end_date: patch.session_date ?? "" }
        : {}),
      ...("session_type" in patch
        ? {
            cohort_id: "",
            target_student_user_id: "",
            capacity: patch.session_type === "PRIVATE_SESSION" ? "1" : "6",
          }
        : {}),
    }));
    setResult(null);
  };
  const fieldError = (key: string) => (result && !result.ok ? result.fields?.[key] : undefined);

  const suggestions =
    values.session_date && (schedule.state === "outside" || schedule.state === "conflict")
      ? availableSuggestions(
          context.availability,
          context.sessions.filter((s) => s.id !== session?.id),
          schedule.minutes && schedule.minutes > 0 ? schedule.minutes : 60,
          values.session_date,
          addDays(values.session_date, 7),
          loadedAt,
        ).slice(0, 4)
      : [];

  const changeStep = (next: number) => {
    setDirection(next > step ? "forward" : "back");
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
          setDirection("back");
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
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const audience = (privateSession ? context.students : context.cohorts).find(
    (c) => c.id === (privateSession ? values.target_student_user_id : values.cohort_id),
  )?.name;
  const dateText = values.session_date
    ? `${relativeDayLabel(values.session_date, localParts(new Date(loadedAt)).date)}, ${formatDay(values.session_date, "long")}`
    : "Data a definir";
  const timeText =
    values.start_time && values.end_time
      ? `${values.start_time} – ${values.end_date && values.end_date !== values.session_date ? `${formatDay(values.end_date, "short")} ` : ""}${values.end_time}${schedule.minutes && schedule.minutes > 0 ? ` (${formatDuration(schedule.minutes)})` : ""}`
      : "Horário a definir";
  const visible = (index: number) => editing || step === index;

  const form = (
    <form
      ref={formRef}
      noValidate={false}
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        if (editing || step === 2) submit();
        else if (formRef.current?.reportValidity()) changeStep(step + 1);
      }}
      className={editing ? styles.editForm : styles.wizardCard}
      data-direction={direction}
    >
      {!editing && (
        <header className={styles.wizardHeader}>
          <span className={styles.stepBadge} aria-hidden="true">
            {step + 1}
          </span>
          <div>
            <h2 ref={stepRef} tabIndex={-1}>
              {steps[step]!.label}
            </h2>
            <p>
              Etapa {step + 1} de {steps.length} · {steps[step]!.description}
            </p>
          </div>
        </header>
      )}
      {editing && (
        <h2 ref={stepRef} tabIndex={-1} className="sr-only">
          Editar sessão
        </h2>
      )}
      {result && !result.ok && (
        <Alert tone="error" title="Sessão não salva" description={result.message} />
      )}
      {session && <input type="hidden" name="id" value={session.id} />}

      <div hidden={!visible(0)} className={styles.step}>
        <Input
          label="Título da sessão"
          name="title"
          required
          maxLength={TITLE_MAX}
          value={values.title}
          placeholder="Ex.: Pronúncia do TH"
          onChange={(e) => update({ title: e.target.value })}
          tone={fieldError("title") ? "error" : "default"}
          message={
            fieldError("title") ??
            `${values.title.length}/${TITLE_MAX} · use um título claro e objetivo para seus alunos.`
          }
        />
        <fieldset className={styles.typeCards} disabled={editing}>
          <legend>
            Tipo de sessão <span aria-hidden="true">*</span>
          </legend>
          {creatableTypes.map((type) => (
            <label
              key={type}
              className={`${styles.typeCard} ${styles.tinted}`}
              data-type={type}
              data-checked={values.session_type === type || undefined}
            >
              <input
                type="radio"
                name={editing ? undefined : "session_type"}
                value={type}
                checked={values.session_type === type}
                onChange={() => update({ session_type: type })}
              />
              <span className={styles.typeCardIcon} aria-hidden="true">
                <Icon name={sessionTypeMeta[type].icon} size={20} />
              </span>
              <span>
                <strong>{teacherSessionTypeLabel(type)}</strong>
                <small>{sessionTypeMeta[type].description}</small>
              </span>
              <span className={styles.typeCardRadio} aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        {editing && <input type="hidden" name="session_type" value={values.session_type} />}
        <div className={styles.dateGrid}>
          <Input
            label="Data"
            name="session_date"
            type="date"
            required
            value={values.session_date}
            readOnly={locked}
            message={fieldError("session_date") ?? ""}
            onChange={(e) => update({ session_date: e.target.value })}
          />
          <Input
            label="Início"
            name="start_time"
            type="time"
            required
            value={values.start_time}
            readOnly={locked}
            onChange={(e) => update({ start_time: e.target.value })}
            message={fieldError("start_time") ?? ""}
          />
          <Input
            label="Término"
            name="end_time"
            type="time"
            required
            value={values.end_time}
            readOnly={locked}
            message={fieldError("end_time") ?? ""}
            onChange={(e) => update({ end_time: e.target.value })}
          />
          <Input
            label="Data de término"
            name="end_date"
            type="date"
            required
            value={values.end_date}
            readOnly={locked}
            message="Igual à data, exceto se passar da meia-noite."
            onChange={(e) => update({ end_date: e.target.value })}
          />
        </div>
        <p className={styles.timezone}>
          <Icon name="globe" size={16} /> Fuso horário <strong>America/Recife</strong> (UTC−3)
        </p>
        <div className={styles.scheduleWrap}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={schedule.state}
              className={styles.schedule}
              data-state={schedule.state}
              role="status"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={yasTokens.motion.springs.snappy}
            >
              <span className={styles.scheduleIcon} aria-hidden="true">
                <Icon name={scheduleIcon[schedule.state]} size={18} />
              </span>
              <div>
                <strong>
                  {schedule.state === "ok"
                    ? "Horário disponível!"
                    : schedule.state === "conflict"
                      ? "Conflito de agenda"
                      : schedule.state === "outside"
                        ? "Fora da disponibilidade"
                        : schedule.state === "invalid"
                          ? "Horário inválido"
                          : "Disponibilidade"}
                </strong>
                <span>{schedule.text}</span>
                {suggestions.length > 0 && !locked && (
                  <span className={styles.slotChips}>
                    <span className="sr-only">Horários livres próximos:</span>
                    {suggestions.map((slot) => {
                      const start = localParts(slot.starts_at),
                        end = localParts(slot.ends_at);
                      return (
                        <button
                          key={slot.starts_at}
                          type="button"
                          className={styles.slotChip}
                          onClick={() =>
                            update({
                              session_date: start.date,
                              end_date: end.date,
                              start_time: start.time,
                              end_time: end.time,
                            })
                          }
                        >
                          {formatDay(start.date, "short")} · {start.time}–{end.time}
                        </button>
                      );
                    })}
                  </span>
                )}
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <div hidden={!visible(1)} className={styles.step}>
        <Select
          label={privateSession ? "Aluno" : "Turma"}
          name={privateSession ? "target_student_user_id" : "cohort_id"}
          required={editing || step === 1}
          disabled={locked}
          value={privateSession ? values.target_student_user_id : values.cohort_id}
          message={
            fieldError(privateSession ? "target_student_user_id" : "cohort_id") ??
            (privateSession
              ? "A sessão particular fica reservada para este aluno."
              : "Sessões em grupo pertencem a uma turma.")
          }
          onChange={(e) =>
            update(
              privateSession
                ? { target_student_user_id: e.target.value }
                : { cohort_id: e.target.value },
            )
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
        <div className={styles.capacity}>
          <Input
            label="Capacidade"
            name="capacity"
            type="number"
            min={1}
            max={6}
            required
            value={values.capacity}
            readOnly={locked || privateSession}
            message={
              fieldError("capacity") ??
              "De 1 a 6 participantes. A criação não reserva vagas nem envia convites."
            }
            onChange={(e) => update({ capacity: e.target.value })}
          />
          {!locked && !privateSession && (
            <div className={styles.capacityButtons}>
              <button
                type="button"
                className={styles.iconLink}
                aria-label="Uma vaga a menos"
                disabled={Number(values.capacity) <= 1}
                onClick={() =>
                  update({ capacity: String(Math.max(1, Number(values.capacity) - 1)) })
                }
              >
                −
              </button>
              <button
                type="button"
                className={styles.iconLink}
                aria-label="Uma vaga a mais"
                disabled={Number(values.capacity) >= 6}
                onClick={() =>
                  update({ capacity: String(Math.min(6, Number(values.capacity) + 1)) })
                }
              >
                +
              </button>
            </div>
          )}
        </div>
        <div
          className={styles.urlField}
          data-state={!meetUrl ? "empty" : MEET_PATTERN.test(meetUrl) ? "valid" : "invalid"}
        >
          <Input
            label="Link do Google Meet (opcional)"
            name="meeting_url"
            type="url"
            maxLength={2048}
            placeholder="https://meet.google.com/abc-defg-hij"
            value={values.meeting_url}
            onChange={(e) => update({ meeting_url: e.target.value })}
            tone={
              fieldError("meeting_url") || (meetUrl && !MEET_PATTERN.test(meetUrl))
                ? "error"
                : "default"
            }
            message={
              fieldError("meeting_url") ??
              (meetUrl && !MEET_PATTERN.test(meetUrl)
                ? "Use um endereço que comece com https://meet.google.com/"
                : editing
                  ? "Deixe vazio para preservar o link existente."
                  : "Crie a sala no Google Meet e cole o link aqui.")
            }
          />
          <AnimatePresence>
            {MEET_PATTERN.test(meetUrl) && (
              <m.span
                className={styles.urlCheck}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={yasTokens.motion.springs.snappy}
                aria-hidden="true"
              >
                <Icon name="check" size={14} strokeWidth={3} />
              </m.span>
            )}
          </AnimatePresence>
        </div>
        {locked && (
          <p className={styles.notice}>
            <Icon name="lock" size={16} /> Há reservas: alterações de horário ou estrutura exigem
            cancelar e criar outra sessão.
          </p>
        )}
      </div>

      {!editing && step === 2 && (
        <div className={styles.step}>
          <section className={styles.review} aria-label="Informações da sessão">
            <header>
              <h3>Informações</h3>
              <button type="button" className={styles.sideLink} onClick={() => changeStep(0)}>
                <Icon name="pen" size={14} /> Editar
              </button>
            </header>
            <dl>
              <div>
                <dt>Título</dt>
                <dd>{values.title}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>
                  {teacherSessionTypeLabel(values.session_type as WorkspaceSession["session_type"])}
                </dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{dateText}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{timeText}</dd>
              </div>
            </dl>
          </section>
          <section className={styles.review} aria-label="Turma e sala">
            <header>
              <h3>Turma e sala</h3>
              <button type="button" className={styles.sideLink} onClick={() => changeStep(1)}>
                <Icon name="pen" size={14} /> Editar
              </button>
            </header>
            <dl>
              <div>
                <dt>{privateSession ? "Aluno" : "Turma"}</dt>
                <dd>{audience ?? "A definir"}</dd>
              </div>
              <div>
                <dt>Capacidade</dt>
                <dd>{values.capacity}</dd>
              </div>
              <div>
                <dt>Sala</dt>
                <dd>{meetUrl ? "Link do Google Meet informado" : "Link a cadastrar depois"}</dd>
              </div>
            </dl>
          </section>
          <Alert
            tone="info"
            title="Validação final no servidor"
            description="A disponibilidade e os vínculos serão conferidos novamente ao criar a sessão."
          />
        </div>
      )}

      <div className={styles.formBar}>
        {!editing && (
          <Link href={back} className="yas-button yas-button--ghost">
            Cancelar
          </Link>
        )}
        <span className={styles.formBarHint} aria-hidden="true">
          Ctrl + Enter
        </span>
        {!editing && step > 0 && (
          <Button variant="outline" onClick={() => changeStep(step - 1)} disabled={pending}>
            Voltar
          </Button>
        )}
        <Button
          variant="secondary"
          type="submit"
          loading={pending}
          trailingIcon={<Icon name={editing || step === 2 ? "check" : "arrow"} size={17} />}
        >
          {editing ? "Salvar encontro" : step === 2 ? "Criar sessão" : "Continuar"}
        </Button>
      </div>
    </form>
  );

  if (editing) return form;

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardSteps}>
        <Stepper
          steps={steps}
          current={step}
          ariaLabel="Etapas da criação"
          onStepSelect={(index) => changeStep(index)}
        />
      </div>
      {form}
      <aside className={styles.summary} aria-label="Resumo da sessão">
        <h2>Resumo da sessão</h2>
        <p className={styles.muted}>Atualizado conforme você preenche.</p>
        <span className={`${styles.type} ${styles.tinted}`} data-type={values.session_type}>
          {teacherSessionTypeLabel(values.session_type as WorkspaceSession["session_type"])}
        </span>
        <strong key={values.title} className={styles.summaryTitle}>
          {values.title || "Título da sessão"}
        </strong>
        <ul className={styles.summaryList}>
          {(
            [
              ["cal", dateText],
              ["clock", timeText],
              ["globe", "America/Recife"],
              ["monitor", "Online · Google Meet"],
              [
                privateSession ? "user" : "layers",
                audience ?? (privateSession ? "Aluno a definir" : "Turma a definir"),
              ],
              [
                "users",
                `Até ${values.capacity} ${values.capacity === "1" ? "participante" : "participantes"}`,
              ],
              ["link", meetUrl ? "Link da sala informado" : "Link da sala a cadastrar"],
            ] as const
          ).map(([icon, text]) => (
            <li key={icon}>
              <Icon name={icon} size={17} />
              <span key={text} className={styles.flash}>
                {text}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.tip}>
          <Icon name="bulb" size={18} />
          <p>
            <strong>Dica</strong>
            Títulos claros e um link de sala cadastrado com antecedência deixam a entrada dos alunos
            mais tranquila.
          </p>
        </div>
      </aside>
    </div>
  );
}
