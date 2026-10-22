"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useId, useState, useTransition } from "react";
import { Alert, Button, Drawer, EmptyState, Icon, Input, Select, useToast } from "@/components/ui";
import { yasTokens } from "@/styles/tokens";
import { saveMeetingResultAction } from "@/app/(protected)/(teacher)/teacher/sessoes/actions";
import {
  addDays,
  availableSuggestions,
  localParts,
  sessionCanEdit,
  weekStart,
  type SessionWorkspace,
  type WorkspaceSession,
} from "../domain/session-workspace";
import {
  formatDay,
  formatDuration,
  formatWeekRange,
  relativeDayLabel,
} from "../domain/session-calendar";
import type { SessionRowLinks } from "./session-row";
import { WeekGrid } from "./week-grid";
import styles from "./sessions.module.css";

const MEET_PATTERN = /^https:\/\/meet\.google\.com\/[A-Za-z0-9-]+\/?$/;

function sessionOptionLabel(session: WorkspaceSession) {
  const start = localParts(session.starts_at);
  return `${session.title} · ${formatDay(start.date, "short")} · ${start.time}–${localParts(session.ends_at).time}`;
}

/**
 * Links the Google Meet room the teacher created. The saved address stays server-only: it is
 * never read back here, only replaced.
 */
export function MeetingSheet({
  open,
  onOpenChange,
  sessions,
  now,
  selected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: readonly WorkspaceSession[];
  now: number;
  selected?: string;
}) {
  const toast = useToast();
  const formId = useId();
  const eligible = sessions.filter((s) => sessionCanEdit(s, now));
  const fixed = selected ? eligible.find((s) => s.id === selected) : undefined;
  const [id, setId] = useState(selected ?? ""),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [pending, startTransition] = useTransition();
  const dirty = Boolean(url && !success);
  const trimmed = url.trim();
  const valid = MEET_PATTERN.test(trimmed);
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        if (!value && dirty && !window.confirm("Descartar o link não salvo?")) return;
        onOpenChange(value);
        if (!value) {
          setUrl("");
          setMessage("");
          setSuccess(false);
        }
      }}
      icon="link"
      title="Cadastrar link do Meet"
      description="Crie a sala no Google Meet e cole o endereço. O acesso dos participantes continua protegido pelo sistema."
      footer={
        eligible.length > 0 && (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Fechar
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="secondary"
              loading={pending}
              leadingIcon={<Icon name="link" size={16} />}
            >
              Salvar link
            </Button>
          </>
        )
      }
    >
      {eligible.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão elegível"
          description="Cadastre uma sessão futura e editável para vincular a sala."
        />
      ) : (
        <form
          id={formId}
          className={styles.sheetForm}
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setMessage("");
              try {
                const result = await saveMeetingResultAction(id, trimmed);
                setSuccess(result.ok);
                setMessage(
                  result.ok
                    ? "Link salvo com sucesso. O acesso continua disponível pelo fluxo autorizado da sessão."
                    : result.message,
                );
                if (result.ok)
                  toast({
                    title: "Sala atualizada",
                    description: "O link do Meet foi vinculado à sessão.",
                  });
              } catch {
                setSuccess(false);
                setMessage("Não foi possível salvar o link. Tente novamente.");
              }
            });
          }}
        >
          {fixed ? (
            <div className={styles.sheetSummary}>
              <Icon name="cal" size={18} />
              <div>
                <strong>{fixed.title}</strong>
                <small>
                  {formatDay(localParts(fixed.starts_at).date, "full")} ·{" "}
                  {localParts(fixed.starts_at).time}–{localParts(fixed.ends_at).time}
                </small>
              </div>
            </div>
          ) : (
            <Select
              label="Sessão"
              required
              value={id}
              onChange={(event) => {
                setId(event.target.value);
                setSuccess(false);
                setMessage("");
              }}
              options={[
                { value: "", label: "Selecione uma sessão" },
                ...eligible.map((s) => ({ value: s.id, label: sessionOptionLabel(s) })),
              ]}
            />
          )}
          <div className={styles.platform}>
            <span className={styles.platformLogo} aria-hidden="true">
              <Icon name="video" size={22} />
            </span>
            <div>
              <strong>Google Meet</strong>
              <small>Plataforma usada nas sessões ao vivo</small>
            </div>
            <span className={styles.platformCheck} aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
          </div>
          <ol className={styles.howTo}>
            <li>
              Crie a sala em{" "}
              <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">
                meet.google.com/new
                <Icon name="external" size={13} />
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>
            <li>Copie o endereço da reunião.</li>
            <li>Cole abaixo e salve.</li>
          </ol>
          <div
            className={styles.urlField}
            data-state={!trimmed ? "empty" : valid ? "valid" : "invalid"}
          >
            <Input
              label="Link do Google Meet"
              type="url"
              required
              maxLength={2048}
              value={url}
              placeholder="https://meet.google.com/abc-defg-hij"
              tone={trimmed && !valid ? "error" : trimmed ? "success" : "default"}
              message={
                trimmed && !valid
                  ? "Use um endereço que comece com https://meet.google.com/"
                  : "Salvar substitui o endereço anterior. O link atual não é exibido aqui."
              }
              onChange={(event) => {
                setUrl(event.target.value);
                setSuccess(false);
                setMessage("");
              }}
            />
            <AnimatePresence>
              {valid && (
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
          {message && (
            <Alert
              tone={success ? "success" : "error"}
              title={success ? "Sala atualizada" : "Link não salvo"}
              description={message}
            />
          )}
        </form>
      )}
    </Drawer>
  );
}

const DURATIONS = [60, 90, 120];

/** Week of registered availability and booked sessions, with ready-to-use free slots. */
export function AvailabilitySheet({
  open,
  onOpenChange,
  context,
  now,
  date,
  today,
  returnTo,
  links,
  names,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SessionWorkspace;
  now: number;
  date: string;
  today: string;
  returnTo: string;
  links: Readonly<Record<string, SessionRowLinks>>;
  names: Readonly<Record<string, string>>;
}) {
  const [week, setWeek] = useState(weekStart(date)),
    [minutes, setMinutes] = useState(60),
    [visible, setVisible] = useState(4);
  const end = addDays(week, 7);
  const suggestions = availableSuggestions(
    context.availability,
    context.sessions,
    minutes,
    week,
    end,
    now,
  );
  const busy = context.sessions.filter((s) => s.status === "SCHEDULED");
  const move = (days: number) => {
    setWeek(addDays(week, days));
    setVisible(4);
  };
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      icon="cal"
      title="Disponibilidade do professor"
      description="Veja os horários livres e escolha o melhor momento para uma nova sessão. O horário é validado novamente ao salvar."
      footer={
        <>
          <span className={styles.muted}>Horários em America/Recife</span>
          <Link
            href="/teacher/disponibilidade"
            className="yas-button yas-button--outline yas-button--sm"
          >
            <Icon name="pen" size={15} />
            Editar disponibilidade
          </Link>
        </>
      }
    >
      {open && (
        <div className={styles.sheetStack}>
          <div className={styles.availabilityControls}>
            <div className={styles.weekPicker}>
              <Icon name="cal" size={17} />
              <strong aria-live="polite">{formatWeekRange(week)}</strong>
              <button
                type="button"
                className={styles.iconLink}
                aria-label="Semana anterior"
                onClick={() => move(-7)}
              >
                <Icon name="left" size={17} />
              </button>
              <button
                type="button"
                className={styles.iconLink}
                aria-label="Próxima semana"
                onClick={() => move(7)}
              >
                <Icon name="right" size={17} />
              </button>
            </div>
            <Select
              label="Duração da sessão"
              value={String(minutes)}
              onChange={(event) => {
                setMinutes(Number(event.target.value));
                setVisible(4);
              }}
              options={DURATIONS.map((n) => ({ value: String(n), label: formatDuration(n) }))}
            />
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={week}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <WeekGrid
                start={week}
                today={today}
                now={now}
                sessions={busy}
                availability={context.availability}
                links={links}
                names={names}
                returnTo={returnTo}
                duration={minutes}
              />
            </m.div>
          </AnimatePresence>
          <ul className={styles.legend} aria-label="Legenda">
            <li data-kind="free">Disponível</li>
            <li data-kind="busy">Ocupado</li>
            <li data-kind="today">Hoje</li>
          </ul>
          <section className={styles.suggestions} aria-labelledby="suggestions-title">
            <header>
              <span className={styles.suggestionsIcon} aria-hidden="true">
                <Icon name="spark" size={18} />
              </span>
              <div>
                <h3 id="suggestions-title">Sugestões disponíveis</h3>
                <p className={styles.muted}>
                  Com base na sua disponibilidade e na duração escolhida.
                </p>
              </div>
            </header>
            {suggestions.length === 0 ? (
              <EmptyState
                title="Nenhum horário livre"
                description="Tente outra duração ou semana, ou revise seus intervalos."
              />
            ) : (
              <ul className={styles.suggestionGrid}>
                {suggestions.slice(0, visible).map((slot, index) => {
                  const day = localParts(slot.starts_at).date;
                  return (
                    <m.li
                      key={slot.starts_at}
                      className={styles.suggestion}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: Math.min(index, 6) * 0.04,
                        ...yasTokens.motion.springs.gentle,
                      }}
                    >
                      <span className={styles.suggestionDate}>
                        <Icon name="cal" size={17} />
                        <span>
                          <strong>
                            {relativeDayLabel(day, today)}, {formatDay(day, "short")}
                          </strong>
                          <small>
                            {localParts(slot.starts_at).time} – {localParts(slot.ends_at).time}
                          </small>
                        </span>
                      </span>
                      <span className={styles.freeBadge}>Disponível</span>
                      <Link
                        className="yas-button yas-button--secondary yas-button--sm yas-button--block"
                        href={`/teacher/sessoes/nova?${new URLSearchParams({ start: slot.starts_at, end: slot.ends_at, returnTo })}`}
                      >
                        Criar sessão neste horário
                      </Link>
                    </m.li>
                  );
                })}
              </ul>
            )}
            {visible < suggestions.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisible((n) => n + 6)}
                trailingIcon={<Icon name="down" size={15} />}
              >
                Ver mais horários
              </Button>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
