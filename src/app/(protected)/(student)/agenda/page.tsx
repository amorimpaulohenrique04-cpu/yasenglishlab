import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import {
  YAS_SCHEDULE_TIME_ZONE,
  scheduleAvailabilityLabel,
  scheduleSessionTypeLabel,
  type ScheduleAvailability,
  type ScheduleSessionView,
} from "@/modules/schedule";
import { loadSchedulePage } from "@/server/schedule/schedule";

import { bookLiveSessionAction } from "./actions";
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

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
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

function statusTone(status: ScheduleAvailability): "success" | "warning" | "info" | "neutral" {
  if (status === "AVAILABLE") return "success";
  if (status === "FULL") return "warning";
  if (status === "BOOKED") return "info";
  return "neutral";
}

function bookingAlert(code: string | undefined) {
  if (code === "success") {
    return (
      <Alert
        tone="success"
        title="Reserva confirmada"
        description="A sessão foi persistida e já aparece entre seus próximos compromissos."
      />
    );
  }
  if (code === "entitlement") {
    return (
      <Alert
        tone="warning"
        title="Sessão não incluída no seu acesso atual"
        description="A disponibilidade da sessão continua visível, mas este entitlement não está ativo para sua conta."
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
        description="O estado da sessão mudou ou já existe uma reserva anterior que a Agenda V1 não pode remarcar."
      />
    );
  }
  if (code === "error") {
    return (
      <Alert
        tone="error"
        title="Não foi possível confirmar a reserva"
        description="Tente novamente. Nenhuma reserva falsa foi exibida como sucesso."
      />
    );
  }
  return null;
}

function DateStrip({ sessions }: { sessions: ScheduleSessionView[] }) {
  const dates = new Map<string, string>();
  for (const session of sessions) {
    const date = new Date(session.startsAt);
    const key = date.toISOString().slice(0, 10);
    if (!dates.has(key)) dates.set(key, dateFormatter.format(date));
    if (dates.size === 7) break;
  }

  return (
    <div className={styles.dateStrip} aria-label="Próximas datas com sessões">
      {[...dates.entries()].map(([key, label], index) => (
        <span key={key} className={styles.dateChip} data-first={index === 0}>
          {label}
        </span>
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: ScheduleSessionView }) {
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const canSubmit = session.availability === "AVAILABLE" && session.eligibility.canBook;
  const entitlementBlocked = session.eligibility.reason === "ENTITLEMENT_REQUIRED";

  return (
    <Card className={styles.sessionCard} aria-labelledby={`session-${session.id}`}>
      <div className={styles.sessionTopline}>
        <Badge tone={statusTone(session.availability)}>
          {scheduleAvailabilityLabel(session.availability)}
        </Badge>
        <span className={styles.sessionType}>{scheduleSessionTypeLabel(session.sessionType)}</span>
      </div>

      <div className={styles.sessionCopy}>
        <h3 id={`session-${session.id}`}>{session.title}</h3>
        <p>
          <time dateTime={session.startsAt}>{longDateFormatter.format(start)}</time>
          {" · "}
          <time dateTime={session.startsAt}>{timeFormatter.format(start)}</time>
          {"–"}
          <time dateTime={session.endsAt}>{timeFormatter.format(end)}</time>
        </p>
      </div>

      <div className={styles.sessionMeta}>
        {session.availability === "BOOKED" ? (
          <span>Sua reserva está confirmada.</span>
        ) : (
          <span>
            {session.spotsRemaining}{" "}
            {session.spotsRemaining === 1 ? "vaga restante" : "vagas restantes"}
            {" · "}
            capacidade {session.capacity}
          </span>
        )}
        {entitlementBlocked && (
          <span className={styles.entitlementNote}>
            Seu entitlement atual não autoriza esta sessão.
          </span>
        )}
      </div>

      <form action={bookLiveSessionAction}>
        <input type="hidden" name="liveSessionId" value={session.id} />
        <Button
          type="submit"
          variant={canSubmit ? "primary" : "secondary"}
          size="sm"
          disabled={!canSubmit}
        >
          {session.availability === "BOOKED"
            ? "Reservado"
            : session.availability === "FULL"
              ? "Lotado"
              : session.availability === "CLOSED"
                ? "Encerrado"
                : entitlementBlocked
                  ? "Acesso não disponível"
                  : "Reservar"}
        </Button>
      </form>
    </Card>
  );
}

function UpcomingBookings({ sessions }: { sessions: ScheduleSessionView[] }) {
  return (
    <Card className={styles.upcomingCard} aria-labelledby="agenda-upcoming-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="agenda-upcoming-title">Próximas reservas</h2>
          <p>Somente reservas da sua conta.</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className={styles.sideEmpty}>Nenhuma reserva futura confirmada.</p>
      ) : (
        <ol className={styles.upcomingList}>
          {sessions.map((session) => (
            <li key={session.id}>
              <span className={styles.upcomingMark} aria-hidden="true">
                {session.sessionType === "PRIVATE_SESSION" ? "1:1" : "Y"}
              </span>
              <span>
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
  const alert = bookingAlert(firstValue(params.booking));

  if (state.status === "unauthorized") {
    return (
      <div className={styles.page}>
        <PageHeader title="Agenda" description="Veja suas sessões e próximos compromissos." />
        <ErrorState
          title="Acesso não autorizado"
          description="Sua conta não possui o papel Student necessário para esta Agenda."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className={styles.page}>
        <PageHeader title="Agenda" description="Veja suas sessões e próximos compromissos." />
        {alert}
        <EmptyState
          title="Nenhuma sessão futura"
          description="Quando novas sessões forem publicadas no domínio Live, elas aparecerão aqui."
        />
      </div>
    );
  }

  const { sessions, upcomingBookings } = state.data;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Agenda"
        description="Veja suas sessões disponíveis e reservas confirmadas."
      />

      {alert}
      <DateStrip sessions={sessions} />

      <div className={styles.layout}>
        <section className={styles.schedulePanel} aria-labelledby="agenda-sessions-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="agenda-sessions-title">Sessões disponíveis</h2>
              <p>Disponibilidade e elegibilidade são calculadas separadamente.</p>
            </div>
          </div>

          <div className={styles.sessionGrid}>
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>

        <aside className={styles.sideColumn} aria-label="Resumo de reservas">
          <UpcomingBookings sessions={upcomingBookings} />
          <Card className={styles.contractCard} variant="soft">
            <strong>Agenda V1</strong>
            <p>
              Reservas usam a capacidade e os entitlements do domínio Live. Cancelamento, remarcação
              e acesso à reunião ainda não fazem parte deste fluxo.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
