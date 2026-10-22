"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Dialog, Drawer, EmptyState, Input, Select } from "@/components/ui";
import {
  cancelSessionResultAction,
  saveSessionResultAction,
  saveMeetingResultAction,
} from "@/app/(protected)/(teacher)/teacher/sessoes/actions";
import {
  availableSuggestions,
  addDays,
  localParts,
  sessionCanCancel,
  sessionCanEdit,
  weekStart,
  type SessionWorkspace,
  type WorkspaceSession,
} from "../domain/session-workspace";
import { SessionForm } from "./session-form";
import styles from "./sessions.module.css";

export function SessionActions({
  session,
  context,
  now,
  initialEdit = false,
  initialCancel = false,
  returnTo = "/teacher/sessoes",
}: {
  session: WorkspaceSession;
  context: SessionWorkspace;
  now: number;
  initialEdit?: boolean;
  initialCancel?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(initialEdit && sessionCanEdit(session, now)),
    [cancel, setCancel] = useState(initialCancel && sessionCanCancel(session)),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [pending, startTransition] = useTransition();
  return (
    <div className={styles.actions}>
      {success && (
        <Alert tone="success" title={success} description="Os dados foram salvos com sucesso." />
      )}
      {sessionCanEdit(session, now) && (
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
          Editar sessão
        </Button>
      )}
      {sessionCanCancel(session) && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setError("");
            setCancel(true);
          }}
        >
          Cancelar sessão
        </Button>
      )}
      <Drawer
        open={edit}
        onOpenChange={(open) => {
          if (!open && dirty && !window.confirm("Descartar as alterações desta sessão?")) return;
          setEdit(open);
          if (!open) setDirty(false);
        }}
        title="Editar sessão"
      >
        {edit && (
          <SessionForm
            context={context}
            session={session}
            action={saveSessionResultAction}
            returnTo={returnTo}
            onDirtyChange={setDirty}
            onSaved={() => {
              setDirty(false);
              setEdit(false);
              setSuccess("Sessão atualizada");
            }}
          />
        )}
      </Drawer>
      <Dialog
        open={cancel}
        onOpenChange={(open) => {
          if (!pending) setCancel(open);
        }}
        title="Cancelar sessão?"
        description={`As ${session.participant_count} reservas ativas serão canceladas. Os participantes receberão o aviso previsto no sistema; nenhuma nova data será proposta automaticamente.`}
      >
        <div className={styles.stack}>
          {error && <Alert tone="error" title="Cancelamento não concluído" description={error} />}
          <p>
            Presenças já registradas impedem o cancelamento. Para remarcar, será necessário criar
            outra sessão.
          </p>
          <div className={styles.actions}>
            <Button disabled={pending} onClick={() => setCancel(false)}>
              Manter sessão
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await cancelSessionResultAction(session.id);
                    if (result.ok) {
                      setCancel(false);
                      setSuccess("Sessão cancelada");
                      router.refresh();
                    } else setError(result.message);
                  } catch {
                    setError("Não foi possível cancelar. Tente novamente.");
                  }
                })
              }
            >
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function MeetingDrawer({
  sessions,
  now,
  selected,
  initialOpen = false,
}: {
  sessions: WorkspaceSession[];
  now: number;
  selected?: string;
  initialOpen?: boolean;
}) {
  const eligible = sessions.filter((s) => sessionCanEdit(s, now));
  const [open, setOpen] = useState(initialOpen && eligible.length > 0),
    [id, setId] = useState(selected ?? ""),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [pending, startTransition] = useTransition();
  const dirty = Boolean(url && !success);
  return (
    <>
      <Button variant="soft" onClick={() => setOpen(true)}>
        Cadastrar link do Meet
      </Button>
      <Drawer
        open={open}
        onOpenChange={(value) => {
          if (pending) return;
          if (!value && dirty && !window.confirm("Descartar o link não salvo?")) return;
          setOpen(value);
        }}
        title="Cadastrar link do Meet"
        description="Crie a sala no Google Meet e cole o endereço. O acesso dos participantes continua protegido pelo sistema."
      >
        {eligible.length === 0 ? (
          <EmptyState
            title="Nenhuma sessão elegível"
            description="Cadastre uma sessão futura e editável para vincular a sala."
          />
        ) : (
          <form
            className={styles.stack}
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                setMessage("");
                try {
                  const result = await saveMeetingResultAction(id, url);
                  setSuccess(result.ok);
                  setMessage(
                    result.ok
                      ? "Link salvo com sucesso. O acesso continua disponível pelo fluxo autorizado da sessão."
                      : result.message,
                  );
                } catch {
                  setSuccess(false);
                  setMessage("Não foi possível salvar o link. Tente novamente.");
                }
              });
            }}
          >
            <Select
              label="Sessão"
              required
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setSuccess(false);
                setMessage("");
              }}
              options={[
                { value: "", label: "Selecione uma sessão" },
                ...eligible.map((s) => ({
                  value: s.id,
                  label: `${s.title} · ${localParts(s.starts_at).date} ${localParts(s.starts_at).time}`,
                })),
              ]}
            />
            <Input
              label="Link do Google Meet"
              type="url"
              required
              maxLength={2048}
              value={url}
              placeholder="https://meet.google.com/abc-defg-hij"
              onChange={(e) => {
                setUrl(e.target.value);
                setSuccess(false);
                setMessage("");
              }}
            />
            <p className={styles.muted}>
              O link atual não é exibido aqui. Salvar substitui o endereço anterior. Não há geração
              automática de sala.
            </p>
            {message && (
              <Alert
                tone={success ? "success" : "error"}
                title={success ? "Sala atualizada" : "Link não salvo"}
                description={message}
              />
            )}
            <Button type="submit" variant="primary" loading={pending}>
              Salvar link
            </Button>
          </form>
        )}
      </Drawer>
    </>
  );
}

export function AvailabilityDrawer({
  context,
  now,
  date,
  returnTo,
}: {
  context: SessionWorkspace;
  now: number;
  date: string;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false),
    [week, setWeek] = useState(weekStart(date)),
    [minutes, setMinutes] = useState(60),
    [visible, setVisible] = useState(6);
  const end = addDays(week, 7),
    suggestions = availableSuggestions(
      context.availability,
      context.sessions,
      minutes,
      week,
      end,
      now,
    );
  return (
    <div className={styles.availability}>
      <Button variant="soft" onClick={() => setOpen(true)}>
        Consultar disponibilidade
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Disponibilidade do professor"
        description="Escolha um horário livre para preparar uma sessão. O horário será validado novamente ao salvar."
      >
        <div className={styles.stack}>
          <div className={styles.actions}>
            <Button
              aria-label="Semana anterior"
              onClick={() => {
                setWeek(addDays(week, -7));
                setVisible(6);
              }}
            >
              ←
            </Button>
            <strong>
              {week} – {addDays(end, -1)}
            </strong>
            <Button
              aria-label="Próxima semana"
              onClick={() => {
                setWeek(addDays(week, 7));
                setVisible(6);
              }}
            >
              →
            </Button>
          </div>
          <Select
            label="Duração da sessão"
            value={String(minutes)}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setVisible(6);
            }}
            options={[30, 45, 60, 90, 120].map((n) => ({
              value: String(n),
              label: `${n} minutos`,
            }))}
          />
          <p className={styles.muted}>
            America/Recife · Intervalos cadastrados e sessões agendadas.
          </p>
          <div className={styles.availabilityWeek}>
            {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((day) => {
              const slots = context.availability.filter(
                (a) => localParts(a.starts_at).date <= day && localParts(a.ends_at).date >= day,
              );
              const busy = context.sessions.filter(
                (s) =>
                  s.status === "SCHEDULED" &&
                  localParts(s.starts_at).date <= day &&
                  localParts(s.ends_at).date >= day,
              );
              return (
                <section key={day}>
                  <h3>
                    {new Intl.DateTimeFormat("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "America/Recife",
                    }).format(new Date(`${day}T12:00:00Z`))}
                  </h3>
                  {slots.length === 0 ? (
                    <p>Sem disponibilidade cadastrada.</p>
                  ) : (
                    slots.map((a) => (
                      <p key={a.id}>
                        Intervalo: {localParts(a.starts_at).time} – {localParts(a.ends_at).time}
                      </p>
                    ))
                  )}
                  {busy.map((s) => (
                    <p className={styles.notice} key={s.id}>
                      Ocupado: {localParts(s.starts_at).time} – {localParts(s.ends_at).time} ·{" "}
                      {s.title}
                    </p>
                  ))}
                </section>
              );
            })}
          </div>
          <h3>Sugestões disponíveis</h3>
          {suggestions.length === 0 ? (
            <EmptyState
              title="Nenhum horário livre"
              description="Tente outra duração ou semana, ou revise seus intervalos."
            />
          ) : (
            suggestions.slice(0, visible).map((s) => (
              <Card key={s.starts_at}>
                <strong>
                  {localParts(s.starts_at).date} · {localParts(s.starts_at).time} –{" "}
                  {localParts(s.ends_at).time}
                </strong>
                <Link
                  className="yas-button yas-button--primary yas-button--sm"
                  href={`/teacher/sessoes/nova?${new URLSearchParams({ start: s.starts_at, end: s.ends_at, returnTo })}`}
                >
                  Criar sessão neste horário
                </Link>
              </Card>
            ))
          )}
          {visible < suggestions.length && (
            <Button onClick={() => setVisible((n) => n + 6)}>Ver mais horários</Button>
          )}
          <Link href="/teacher/disponibilidade" className="yas-button yas-button--outline">
            Editar disponibilidade
          </Link>
        </div>
      </Drawer>
    </div>
  );
}
