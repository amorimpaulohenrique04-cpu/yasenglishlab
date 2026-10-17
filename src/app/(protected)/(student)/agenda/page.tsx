import Link from "next/link";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconBadge,
  PageHeader,
  type IconName,
  type Tint,
} from "@/components/ui";
import {
  YAS_SCHEDULE_TIME_ZONE,
  scheduleAvailabilityLabel,
  scheduleSessionTypeLabel,
  type ScheduleAvailability,
  type ScheduleSessionView,
} from "@/modules/schedule";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadSchedulePage } from "@/server/schedule/schedule";

import { bookLiveSessionAction, cancelLiveSessionAction, joinLiveSessionAction } from "./actions";
import { JoinMeeting } from "@/modules/schedule/ui/join-meeting";
import styles from "@/modules/schedule/ui/schedule.module.css";

interface AgendaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const typeVisual: Record<ScheduleSessionView["sessionType"], { icon: IconName; tint: Tint }> = {
  CORE_CLASS: { icon: "play-sq", tint: "lilac" },
  CONVERSATION_LAB: { icon: "chat", tint: "blue" },
  PRIVATE_SESSION: { icon: "user", tint: "pink" },
  WORKSHOP: { icon: "users", tint: "yellow" },
};

function statusTone(status: ScheduleAvailability): "success" | "warning" | "info" | "neutral" {
  if (status === "AVAILABLE") return "success";
  if (status === "FULL") return "warning";
  if (status === "BOOKED") return "info";
  return "neutral";
}

function groupByDay(sessions: ScheduleSessionView[]) {
  const today = dayKeyFormatter.format(new Date());
  const groups = new Map<string, { label: string; today: boolean; items: ScheduleSessionView[] }>();
  for (const session of sessions) {
    const date = new Date(session.startsAt);
    const key = dayKeyFormatter.format(date);
    const group = groups.get(key) ?? {
      label: dayLabelFormatter.format(date),
      today: key === today,
      items: [],
    };
    group.items.push(session);
    groups.set(key, group);
  }
  return [...groups.entries()];
}

function bookingAlert(code: string | undefined) {
  if (code === "quota")
    return (
      <Alert
        tone="warning"
        title="Limite de reservas atingido"
        description="Você já utilizou a quota deste período para este tipo de encontro."
      />
    );
  if (code === "cancelled")
    return (
      <Alert
        tone="success"
        title="Reserva cancelada"
        description="O crédito é liberado quando o cancelamento acontece antes do início da sessão."
      />
    );
  if (code === "cancel_closed") {
    return (
      <Alert
        tone="warning"
        title="Esta reserva não pode mais ser cancelada"
        description="O cancelamento não é permitido após o início da sessão ou depois de registrada a presença."
      />
    );
  }
  if (code === "cancel_error") {
    return (
      <Alert
        tone="error"
        title="Não foi possível cancelar a reserva"
        description="Tente novamente em instantes."
      />
    );
  }
  if (code === "success") {
    return (
      <Alert
        tone="success"
        title="Reserva confirmada"
        description="A sessão já aparece entre seus próximos compromissos."
      />
    );
  }
  if (code === "entitlement") {
    return (
      <Alert
        tone="warning"
        title="Sessão não incluída no seu acesso atual"
        description="Você continua vendo a sessão, mas o seu plano atual não inclui este tipo de encontro."
      />
    );
  }
  if (code === "full") {
    return (
      <Alert
        tone="warning"
        title="A sessão acabou de lotar"
        description="Outra reserva foi confirmada antes da sua tentativa. A capacidade não foi ultrapassada."
      />
    );
  }
  if (code === "closed") {
    return (
      <Alert
        tone="warning"
        title="Esta sessão não aceita novas reservas"
        description="O estado da sessão mudou ou ela já começou."
      />
    );
  }
  if (code === "error") {
    return (
      <Alert
        tone="error"
        title="Não foi possível confirmar a reserva"
        description="Tente novamente em instantes. Nada foi reservado."
      />
    );
  }
  return null;
}

function SessionCard({
  session,
  suspended = false,
}: {
  session: ScheduleSessionView;
  suspended?: boolean;
}) {
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const canSubmit =
    !suspended && session.availability === "AVAILABLE" && session.eligibility.canBook;
  const entitlementBlocked = session.eligibility.reason === "ENTITLEMENT_REQUIRED";
  const visual = typeVisual[session.sessionType];
  const booked = session.availability === "BOOKED";

  return (
    <Card
      className={styles.sessionCard}
      data-booked={booked || undefined}
      aria-labelledby={`session-${session.id}`}
    >
      <div className={styles.sessionTime}>
        <time dateTime={session.startsAt}>{timeFormatter.format(start)}</time>
        <small>
          até <time dateTime={session.endsAt}>{timeFormatter.format(end)}</time>
        </small>
      </div>

      <div className={styles.sessionCopy}>
        <div className={styles.sessionTopline}>
          <span className={styles.sessionType} data-tint={visual.tint}>
            <Icon name={visual.icon} size={14} />
            {scheduleSessionTypeLabel(session.sessionType)}
          </span>
          <Badge tone={statusTone(session.availability)} dot>
            {scheduleAvailabilityLabel(session.availability)}
          </Badge>
        </div>
        <h3 id={`session-${session.id}`}>{session.title}</h3>
        <div className={styles.sessionMeta}>
          <span>
            <Icon name="cal" size={15} />
            <time dateTime={session.startsAt}>{dateFormatter.format(start)}</time>
          </span>
          {session.availability === "BOOKED" ? (
            <span>
              <Icon name="check-c" size={15} />
              Sua reserva está confirmada.
            </span>
          ) : (
            <span>
              <Icon name="users" size={15} />
              {session.spotsRemaining}{" "}
              {session.spotsRemaining === 1 ? "vaga restante" : "vagas restantes"} · capacidade{" "}
              {session.capacity}
            </span>
          )}
          {session.quota?.total != null && (
            <span>
              <Icon name="history" size={15} />
              Quota {session.quota.cadence === "WEEK" ? "semanal" : "mensal"}: {session.quota.used}/
              {session.quota.total} utilizadas · {session.quota.remaining} disponíveis
            </span>
          )}
        </div>
        {entitlementBlocked && (
          <span className={styles.sessionNote}>
            Este tipo de encontro não está incluído no seu plano.
          </span>
        )}
        {session.eligibility.reason === "QUOTA_EXCEEDED" && (
          <span className={styles.sessionNote}>Limite deste período atingido.</span>
        )}
        {suspended && session.availability !== "BOOKED" && (
          <span className={styles.sessionNote} id={`suspended-${session.id}`}>
            Reservas em pausa enquanto a assinatura é regularizada.
          </span>
        )}
        {session.eligibility.reason === "COHORT_REQUIRED" && (
          <span className={styles.sessionNote}>
            Seu vínculo com esta turma não permite novas reservas.
          </span>
        )}
      </div>

      {booked ? (
        /* Reserva confirmada: entrar é a ação principal; recursos e cancelamento em seguida. */
        <div className={styles.bookedActions}>
          <JoinMeeting sessionId={session.id} action={joinLiveSessionAction} />
          {session.ownBookingStatus === "BOOKED" && (
            <Link
              className="yas-button yas-button--outline yas-button--sm"
              href={`/agenda/${session.id}`}
            >
              <Icon name="file" size={16} />
              Recursos e tarefas
            </Link>
          )}
          <form action={cancelLiveSessionAction} className={styles.cancelForm}>
            <input type="hidden" name="liveSessionId" value={session.id} />
            <Button type="submit" variant="ghost" size="sm" className={styles.cancelButton}>
              Cancelar reserva
            </Button>
          </form>
        </div>
      ) : (
        <div className={styles.sessionActions}>
          <form action={bookLiveSessionAction}>
            <input type="hidden" name="liveSessionId" value={session.id} />
            <Button
              type="submit"
              variant={canSubmit ? "primary" : "outline"}
              size="sm"
              disabled={!canSubmit}
              aria-describedby={suspended ? `suspended-${session.id}` : undefined}
            >
              {suspended
                ? "Reservas em pausa"
                : session.availability === "FULL"
                  ? "Lotado"
                  : session.availability === "CLOSED"
                    ? "Encerrado"
                    : entitlementBlocked
                      ? "Acesso não disponível"
                      : session.eligibility.reason === "QUOTA_EXCEEDED"
                        ? "Quota esgotada"
                        : session.ownBookingStatus === "CANCELLED"
                          ? "Reservar novamente"
                          : "Reservar"}
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function UpcomingBookings({ sessions }: { sessions: ScheduleSessionView[] }) {
  return (
    <Card aria-labelledby="agenda-upcoming-title">
      <div className="yas-card-header">
        <h2 className="yas-card-title" id="agenda-upcoming-title">
          Próximas reservas
        </h2>
      </div>

      {sessions.length === 0 ? (
        <p className={styles.sideEmpty}>Nenhuma reserva futura confirmada.</p>
      ) : (
        <ol className="yas-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <IconBadge
                icon={typeVisual[session.sessionType].icon}
                tone={typeVisual[session.sessionType].tint}
                shape="square"
              />
              <span className="yas-list-text">
                <strong>{session.title}</strong>
                <small>
                  {dateFormatter.format(new Date(session.startsAt))} ·{" "}
                  {timeFormatter.format(new Date(session.startsAt))}
                </small>
              </span>
              <Badge tone="info">Reservado</Badge>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const state = await loadSchedulePage();
  const access = await loadCurrentSubscriptionAccess();
  const suspended = access.kind === "suspended";
  const bookingCode = firstValue(params.booking);
  // The notice already explains the suspension; a stale ?booking=suspended after paying gets a soft hint.
  const alert =
    bookingCode === "suspended" ? (
      suspended ? null : (
        <Alert
          tone="info"
          title="Sua reserva não foi feita"
          description="O acesso estava em pausa naquele momento. Se o pagamento já foi confirmado, você pode reservar de novo agora."
        />
      )
    ) : (
      bookingAlert(bookingCode)
    );
  const notice = <SubscriptionSuspendedNotice access={access} context="agenda" />;

  if (state.status === "unauthorized") {
    return (
      <div className={styles.page}>
        <PageHeader title="Agenda" description="Veja suas sessões e próximos compromissos." />
        <ErrorState
          title="Acesso não autorizado"
          description="Esta agenda é exclusiva para contas de aluno."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className={styles.page}>
        <PageHeader
          title="Agenda"
          description="Veja suas sessões e próximos compromissos."
          tagline
        />
        {notice}
        {alert}
        <EmptyState
          title="Nenhuma sessão futura"
          description="Quando novas sessões forem publicadas, elas aparecerão aqui."
        />
      </div>
    );
  }

  const { sessions, upcomingBookings } = state.data;
  const days = groupByDay(sessions);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Agenda"
        description="Veja suas aulas ao vivo, reserve encontros e acompanhe seus compromissos."
        tagline
      />

      {notice}
      {alert}

      <div className={styles.layout}>
        <section className={styles.schedulePanel} aria-labelledby="agenda-sessions-title">
          <div className={styles.sectionHeading}>
            <h2 id="agenda-sessions-title">Sessões disponíveis</h2>
            <span className={styles.timezone}>
              <Icon name="globe" size={16} />
              Horário de Recife (UTC−3)
            </span>
          </div>

          {days.map(([key, day]) => (
            <div className={styles.dayGroup} key={key}>
              <h3 className={styles.dayTitle}>
                {day.label}
                {day.today && <span className={styles.todayChip}>Hoje</span>}
              </h3>
              <div className={styles.sessionList}>
                {day.items.map((session) => (
                  <SessionCard key={session.id} session={session} suspended={suspended} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className={styles.sideColumn} aria-label="Resumo de reservas">
          <UpcomingBookings sessions={upcomingBookings} />
          <Card>
            <div className="yas-card-header">
              <h2 className="yas-card-title">Como funcionam as reservas</h2>
            </div>
            <ul className={styles.rules}>
              <li>
                <Icon name="clock" size={16} />O link da reunião abre 15 minutos antes do encontro.
              </li>
              <li>
                <Icon name="redo" size={16} />
                Cancelar antes do início devolve o crédito da reserva.
              </li>
              <li>
                <Icon name="users" size={16} />
                Cada encontro respeita a capacidade e a quota do seu plano.
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
