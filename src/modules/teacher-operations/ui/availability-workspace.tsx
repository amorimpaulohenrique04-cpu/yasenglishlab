"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components/motion";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Drawer,
  Icon,
  PageHeader,
  Radio,
  Select,
  useToast,
} from "@/components/ui";
import { addDays, localParts } from "../domain/session-workspace";
import {
  formatDay,
  formatDuration,
  formatWeekRange,
  relativeDayLabel,
} from "../domain/session-calendar";
import {
  availabilityActiveSlotCount,
  availabilityFreeMinutes,
  availabilityOccurrences,
  availabilityUrl,
  availabilityWeekStart,
  slotDate,
  weekdayOf,
  type AvailabilityActionResult,
  type AvailabilityCommand,
  type AvailabilityConflict,
  type AvailabilityErrorCode,
  type AvailabilityFilters,
  type AvailabilitySelection,
  type AvailabilitySlot,
  type AvailabilityWorkspaceData,
} from "../domain/availability-workspace";
import { AvailabilityBoard } from "./availability-board";
import {
  AvailabilityForm,
  AvailabilityTimeFields,
  createAvailabilityCommand,
  makeAvailabilityDraft,
} from "./availability-form";
import styles from "./availability-workspace.module.css";

type Scope = "occurrence" | "future";
type Pending = { slot: AvailabilitySlot; action: "PAUSE" | "RESUME" | "DELETE" };
type Failure = {
  ok: false;
  code: AvailabilityErrorCode | "NETWORK";
  message: string;
  conflicts: AvailabilityConflict[];
};
export function AvailabilityWorkspace({
  data,
  filters,
  today,
  now,
  action,
}: {
  data: AvailabilityWorkspaceData;
  filters: AvailabilityFilters;
  today: string;
  now: number;
  action: (id: string, input: unknown) => Promise<AvailabilityActionResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  const week = availabilityWeekStart(filters.date);
  const [draft, setDraft] = useState(() =>
    makeAvailabilityDraft(filters.date >= today ? filters.date : today, now),
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState<AvailabilitySlot | null>(null);
  const [editTime, setEditTime] = useState({ startTime: "", endTime: "" });
  const [scope, setScope] = useState<Scope>("occurrence");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [navigating, startNavigation] = useTransition();
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  // Optimistic toggles stay valid until fresh props (a new `data`) arrive, so the switch never flickers back.
  const [optimistic, setOptimisticState] = useState<{
    base: AvailabilityWorkspaceData;
    map: Record<string, boolean>;
  } | null>(null);
  const optimisticMap = optimistic && optimistic.base === data ? optimistic.map : null;
  const setOptimistic = (map: Record<string, boolean>) =>
    setOptimisticState(Object.keys(map).length ? { base: data, map } : null);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const showList = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listTitle.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    listTitle.current?.focus({ preventScroll: true });
  };
  const go = (patch: Partial<AvailabilityFilters>) =>
    startNavigation(() => router.replace(availabilityUrl(filters, patch), { scroll: false }));
  const select = (selection: AvailabilitySelection) => {
    setDraft((current) => {
      const day = weekdayOf(selection.date);
      // A clicked day is added to the chips already chosen in the same week.
      const keep =
        current.repeat ||
        (!!current.date &&
          availabilityWeekStart(current.date) === availabilityWeekStart(selection.date));
      return {
        ...current,
        ...selection,
        until: current.repeat ? current.until : addDays(selection.date, 56),
        weekdays:
          keep && current.weekdays.length ? [...new Set([...current.weekdays, day])].sort() : [day],
      };
    });
    setFailure(null);
    if (root.current && root.current.getBoundingClientRect().width < 768) setComposerOpen(true);
    else
      root.current
        ?.querySelector<HTMLElement>("[data-composer] input")
        ?.focus({ preventScroll: true });
  };
  const edit = (slot: AvailabilitySlot) => {
    setEditing(slot);
    setScope("occurrence");
    setEditTime({
      startTime: localParts(slot.starts_at).time,
      endTime: localParts(slot.ends_at).time,
    });
    setFailure(null);
  };
  const mutate = async (command: AvailabilityCommand) => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const fingerprint = JSON.stringify(command);
    if (operation.current?.fingerprint !== fingerprint)
      operation.current = { fingerprint, id: crypto.randomUUID() };
    const optimisticIds =
      command.action === "PAUSE" || command.action === "RESUME"
        ? data.slots
            .filter(
              (s) =>
                s.id === command.id ||
                (command.scope === "future" &&
                  s.series_id &&
                  s.series_id === pending?.slot.series_id &&
                  s.starts_at >= pending.slot.starts_at),
            )
            .map((s) => s.id)
        : [];
    if (optimisticIds.length)
      setOptimistic(
        Object.fromEntries(optimisticIds.map((id) => [id, command.action === "RESUME"])),
      );
    try {
      const result = await action(operation.current!.id, command);
      if (!result.ok) {
        setFailure(result);
        setOptimistic({});
        return;
      }
      operation.current = null;
      setPreview(false);
      setComposerOpen(false);
      setPending(null);
      setEditing(null);
      toast({
        title:
          command.action === "DELETE"
            ? "Horário removido"
            : command.action === "PAUSE"
              ? "Disponibilidade pausada"
              : command.action === "RESUME"
                ? "Disponibilidade reativada"
                : "Disponibilidade salva",
        description: `${result.count} ${result.count === 1 ? "horário atualizado" : "horários atualizados"}.`,
      });
    } catch {
      setFailure({
        ok: false,
        code: "NETWORK",
        message: "A conexão falhou. Tente novamente; seus dados foram preservados.",
        conflicts: [],
      });
      setOptimistic({});
    } finally {
      setBusy(false);
    }
  };
  const errorView = failure && (
    <div className={styles.failure}>
      <Alert
        tone="error"
        title={
          failure.code === "NETWORK" || failure.code === "unknown"
            ? "Não foi possível confirmar a alteração"
            : "Nenhum horário foi alterado"
        }
        description={failure.message}
      />
      {failure.conflicts.length > 0 && (
        <ul>
          {failure.conflicts.map((conflict, i) => (
            <li key={`${conflict.date}-${i}`}>
              {formatDay(conflict.date, "numeric")} ·{" "}
              {conflict.sessionId ? (
                <Link href={`/teacher/sessoes/${conflict.sessionId}`}>
                  {conflict.title ?? "Ver sessão agendada"} <Icon name="arrow" size={13} />
                </Link>
              ) : (
                "Sobreposição de horários"
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const scopedSlots = data.slots
    .filter(
      (slot) =>
        filters.status === "all" || (filters.status === "active" ? slot.active : !slot.active),
    )
    .sort((a, b) =>
      filters.order === "time"
        ? localParts(a.starts_at).time.localeCompare(localParts(b.starts_at).time) ||
          a.starts_at.localeCompare(b.starts_at)
        : a.starts_at.localeCompare(b.starts_at),
    );
  const activeCount = availabilityActiveSlotCount(data, week, now);
  const listActive = data.slots.filter(
    (s) => (optimisticMap?.[s.id] ?? s.active) && Date.parse(s.ends_at) > now,
  ).length;
  const minutes = availabilityFreeMinutes(data, week, now);
  const next = data.next_free;
  const createCommand = createAvailabilityCommand(draft, today);
  const occurrences = availabilityOccurrences(createCommand, now);
  const impact = (slot: AvailabilitySlot) => (
    <p className={styles.impact}>
      {scope === "future" && slot.series_id
        ? `${slot.future_count} ocorrências futuras, até ${slot.future_until ? formatDay(localParts(slot.future_until).date, "numeric") : slot.series_until}. Inclui ajustes individuais feitos nesse período.`
        : `Somente ${formatDay(slotDate(slot), "numeric")}, ${localParts(slot.starts_at).time} – ${localParts(slot.ends_at).time}.`}
    </p>
  );
  const scopePicker = (slot: AvailabilitySlot) =>
    slot.series_id ? (
      <fieldset className={styles.scope}>
        <legend>Aplicar a</legend>
        <Radio
          name="availability-scope"
          label="Somente esta ocorrência"
          value="occurrence"
          checked={scope === "occurrence"}
          onChange={() => setScope("occurrence")}
          disabled={busy}
        />
        <Radio
          name="availability-scope"
          label="Esta e todas as futuras"
          value="future"
          checked={scope === "future"}
          onChange={() => setScope("future")}
          disabled={busy}
        />
      </fieldset>
    ) : null;
  const nextDay = next ? localParts(next.starts_at).date : null;
  const nextLabel =
    next && nextDay
      ? `${
          nextDay === today || nextDay === addDays(today, 1)
            ? relativeDayLabel(nextDay, today)
            : `${relativeDayLabel(nextDay, today)}, ${formatDay(nextDay, "short")}`
        }, ${localParts(next.starts_at).time} – ${localParts(next.ends_at).time}`
      : "Nenhum intervalo futuro";
  return (
    <div className={styles.page} ref={root}>
      <PageHeader
        title="Disponibilidade"
        description="Defina seus horários disponíveis para aulas e encontros ao vivo."
        actions={
          <span className={styles.timezone}>
            <Icon name="globe" size={16} />
            Horário de Brasília (GMT−3)
          </span>
        }
      />
      <div className={styles.metrics}>
        <button type="button" className={styles.metric} onClick={showList}>
          <span className={styles.iconTile} data-tone="lilac">
            <Icon name="cal" size={24} />
          </span>
          <div>
            <strong className={styles.metricValue}>
              <AnimatedNumber value={activeCount} />
            </strong>
            <h2>Horários ativos</h2>
            <p>Na semana selecionada</p>
          </div>
          <Icon name="right" size={16} className={styles.metricMore} />
        </button>
        <section className={styles.metric}>
          <span className={styles.iconTile} data-tone="blue">
            <Icon name="clock" size={24} />
          </span>
          <div>
            <strong className={styles.metricValue}>{formatDuration(minutes)}</strong>
            <h2>Horas disponíveis na semana</h2>
            <p>Descontando sessões agendadas</p>
          </div>
        </section>
        <section className={styles.metric}>
          <span className={styles.iconTile} data-tone="yellow">
            <Icon name="bell" size={23} />
          </span>
          <div>
            <h2>Próximo intervalo</h2>
            <strong className={styles.next}>{nextLabel}</strong>
          </div>
        </section>
        <section className={styles.metric}>
          <span className={styles.iconTile} data-tone="green">
            <Icon name="eye" size={24} />
          </span>
          <div>
            <h2 className={styles.configured}>
              {activeCount ? "Disponibilidade configurada" : "Configure seus horários"}
            </h2>
            <p>Alunos visualizam as sessões abertas para reserva.</p>
          </div>
        </section>
      </div>
      <div className={styles.mobileAdd}>
        <Button
          leadingIcon={<Icon name="plus" size={17} />}
          onClick={() => {
            setFailure(null);
            setComposerOpen(true);
          }}
        >
          Adicionar horário
        </Button>
      </div>
      <div className={styles.workspace}>
        <section
          className={styles.calendarPanel}
          aria-label="Calendário de disponibilidade"
          aria-busy={navigating}
        >
          <header className={styles.calendarHeader}>
            <h2>Minha semana</h2>
            <nav aria-label="Navegar pelas semanas">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Semana anterior"
                onClick={() => go({ date: addDays(filters.date, -7) })}
              >
                <Icon name="left" size={17} />
              </Button>
              <strong aria-live="polite">{formatWeekRange(week, { longMonth: true })}</strong>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Próxima semana"
                onClick={() => go({ date: addDays(filters.date, 7) })}
              >
                <Icon name="right" size={17} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => go({ date: today })}>
                Hoje
              </Button>
            </nav>
          </header>
          <AvailabilityBoard
            week={week}
            today={today}
            now={now}
            selectedDay={filters.date}
            data={data}
            onDay={(date) => go({ date })}
            onSelect={select}
            onEdit={edit}
          />
        </section>
        <aside className={styles.aside} aria-label="Gerenciar disponibilidade">
          <section className={`${styles.panel} ${styles.desktopComposer}`} data-composer>
            <h2>Adicionar horário</h2>
            <AvailabilityForm
              draft={draft}
              onChange={(value) => {
                setDraft(value);
                setFailure(null);
              }}
              onPreview={() => {
                setFailure(null);
                setPreview(true);
              }}
              today={today}
              now={now}
              busy={busy}
            />
          </section>
          <section className={styles.panel}>
            <header className={styles.listHeader}>
              <h2 ref={listTitle} tabIndex={-1} className={styles.listTitle}>
                Meus horários ativos <Badge tone="info">{listActive}</Badge>
              </h2>
              <Select
                label="Ordenar horários"
                value={filters.order}
                onChange={(e) => go({ order: e.target.value === "time" ? "time" : "day" })}
                options={[
                  { value: "day", label: "Ordenar por dia" },
                  { value: "time", label: "Ordenar por início" },
                ]}
              />
            </header>
            <div className={styles.listFilters} role="group" aria-label="Filtrar horários">
              {[
                { value: "all", label: "Todos" },
                { value: "active", label: "Ativos" },
                { value: "paused", label: "Pausados" },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={filters.status === option.value}
                  onClick={() => go({ status: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {scopedSlots.length ? (
              <ul className={styles.slotList}>
                {scopedSlots.map((slot) => {
                  const active = optimisticMap?.[slot.id] ?? slot.active;
                  const past = Date.parse(slot.starts_at) <= now;
                  return (
                    <li className={styles.slotRow} key={slot.id} data-active={active}>
                      <div className={styles.slotDay}>
                        <strong>{formatDay(slotDate(slot), "weekday")}</strong>
                        <small>{formatDay(slotDate(slot), "short")}</small>
                        {slot.series_id && (
                          <span title={`Semanal até ${slot.series_until}`}>
                            <Icon name="redo" size={12} />
                            até {slot.series_until?.slice(8)}/{slot.series_until?.slice(5, 7)}
                          </span>
                        )}
                      </div>
                      <div className={styles.slotTime}>
                        <strong>
                          {localParts(slot.starts_at).time} – {localParts(slot.ends_at).time}
                        </strong>
                        <small>
                          <span className={styles.durationChip}>
                            {formatDuration(
                              Math.round(
                                (Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60000,
                              ),
                            )}
                          </span>
                          {past ? " Passado" : !active ? " Pausado" : ""}
                        </small>
                      </div>
                      <button
                        role="switch"
                        aria-checked={active}
                        type="button"
                        aria-label={`${active ? "Pausar" : "Reativar"} horário de ${formatDay(slotDate(slot), "full")} às ${localParts(slot.starts_at).time}`}
                        className="yas-switch"
                        disabled={past || busy}
                        onClick={() => {
                          setFailure(null);
                          if (slot.series_id) {
                            setPending({ slot, action: active ? "PAUSE" : "RESUME" });
                            setScope("occurrence");
                          } else
                            void mutate({
                              action: active ? "PAUSE" : "RESUME",
                              id: slot.id,
                              scope: "occurrence",
                            });
                        }}
                      />
                      <div className={styles.slotActions}>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={past || busy}
                          aria-label={`Editar horário de ${formatDay(slotDate(slot), "numeric")}`}
                          onClick={() => edit(slot)}
                        >
                          <Icon name="pen" size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={past || busy}
                          aria-label={`Excluir horário de ${formatDay(slotDate(slot), "numeric")}`}
                          onClick={() => {
                            setPending({ slot, action: "DELETE" });
                            setScope("occurrence");
                            setFailure(null);
                          }}
                        >
                          <Icon name="trash" size={16} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={styles.empty}>
                <Icon name="cal" size={28} />
                <h3>
                  Nenhum horário{" "}
                  {filters.status === "paused"
                    ? "pausado"
                    : filters.status === "active"
                      ? "ativo"
                      : "nesta semana"}
                </h3>
                <p>Use o formulário ou selecione um período no calendário.</p>
              </div>
            )}
            {!pending && !editing && !preview && errorView}
          </section>
          <section className={styles.rules} aria-labelledby="availability-rules">
            <h2 id="availability-rules">
              <Icon name="shield" size={20} />
              Regras e preferências
            </h2>
            <ul>
              <li>Fuso fixo: Horário de Brasília (GMT−3).</li>
              <li>Horários ativos não podem se sobrepor.</li>
              <li>
                Sessões agendadas travam o horário: não é possível excluir nem pausar a
                disponibilidade que as cobre.
              </li>
              <li>A recorrência semanal vai até uma data final escolhida.</li>
              <li>Horários que já começaram não podem ser editados.</li>
              <li>Alunos visualizam as sessões abertas para reserva.</li>
            </ul>
          </section>
        </aside>
      </div>
      <Drawer
        open={composerOpen}
        onOpenChange={(open) => {
          if (!busy) setComposerOpen(open);
        }}
        title="Adicionar horário"
        icon="cal"
      >
        <AvailabilityForm
          draft={draft}
          onChange={(value) => {
            setDraft(value);
            setFailure(null);
          }}
          onPreview={() => {
            setFailure(null);
            setPreview(true);
          }}
          today={today}
          now={now}
          busy={busy}
        />
      </Drawer>
      <Dialog
        open={preview}
        onOpenChange={(open) => {
          if (!busy) setPreview(open);
        }}
        title={draft.repeat ? "Adicionar horários recorrentes?" : "Adicionar este horário?"}
        icon="cal"
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setPreview(false)}>
              Voltar
            </Button>
            <Button
              loading={busy}
              disabled={!occurrences.length}
              onClick={() => void mutate(createCommand)}
            >
              Confirmar {occurrences.length} {occurrences.length === 1 ? "horário" : "horários"}
            </Button>
          </>
        }
      >
        <p className={styles.impact}>
          {occurrences.length}{" "}
          {occurrences.length === 1 ? "ocorrência futura" : "ocorrências futuras"} ·{" "}
          {draft.startTime} – {draft.endTime}
          {draft.repeat
            ? ` · até ${formatDay(draft.until, "numeric")}`
            : createCommand.repeat
              ? ` · ${formatDay(createCommand.date, "numeric")} a ${formatDay(createCommand.until, "numeric")}`
              : ` · ${formatDay(createCommand.date, "numeric")}`}
          . Nenhuma sessão será criada automaticamente.
        </p>
        {errorView}
      </Dialog>
      <Drawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
        title="Editar horário"
        icon="pen"
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={
                !editTime.startTime || !editTime.endTime || editTime.startTime >= editTime.endTime
              }
              onClick={() =>
                editing && void mutate({ action: "EDIT", id: editing.id, scope, ...editTime })
              }
            >
              Salvar horário
            </Button>
          </>
        }
      >
        {editing && (
          <div className={styles.editor}>
            <p>{formatDay(slotDate(editing), "full")}</p>
            <AvailabilityTimeFields
              {...editTime}
              readOnly={busy}
              onChange={(patch) => setEditTime((current) => ({ ...current, ...patch }))}
            />
            {scopePicker(editing)}
            {impact(editing)}
            {errorView}
          </div>
        )}
      </Drawer>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={
          pending?.action === "DELETE"
            ? "Excluir disponibilidade?"
            : pending?.action === "PAUSE"
              ? "Pausar disponibilidade?"
              : "Reativar disponibilidade?"
        }
        icon={pending?.action === "DELETE" ? "alert" : "cal"}
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant={pending?.action === "DELETE" ? "danger" : "secondary"}
              loading={busy}
              onClick={() =>
                pending && void mutate({ action: pending.action, id: pending.slot.id, scope })
              }
            >
              {pending?.action === "DELETE"
                ? "Excluir"
                : pending?.action === "PAUSE"
                  ? "Pausar"
                  : "Reativar"}
            </Button>
          </>
        }
      >
        {pending && (
          <>
            {scopePicker(pending.slot)}
            {impact(pending.slot)}
            <p className={styles.muted}>
              A operação será bloqueada se retirar a cobertura de sessões agendadas.
            </p>
            {errorView}
          </>
        )}
      </Dialog>
    </div>
  );
}
