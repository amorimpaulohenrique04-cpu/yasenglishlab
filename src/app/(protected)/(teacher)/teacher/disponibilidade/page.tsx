import {
  Alert,
  Badge,
  Button,
  Card,
  DetailDrawer,
  EmptyState,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import { AvailabilitySlotForm } from "./availability-slot-form";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { saveAvailabilityAction } from "./actions";

const TIME_ZONE = "America/Recife";
const WEEKDAYS = [
  { key: "Mon", label: "Seg" },
  { key: "Tue", label: "Ter" },
  { key: "Wed", label: "Qua" },
  { key: "Thu", label: "Qui" },
  { key: "Fri", label: "Sex" },
  { key: "Sat", label: "Sáb" },
  { key: "Sun", label: "Dom" },
];

function weekdayKey(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(
    new Date(value),
  );
}
function timeOf(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
function dateOf(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
function duration(start: string, end: string) {
  const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}min` : ""].filter(Boolean).join(" ") || "0min";
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ save?: string }>;
}) {
  const context = await loadTeacherOperationContext();
  const slots = [...context.availability].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className={styles.page}>
      <PageHeader
        title="Disponibilidade"
        description="Defina os horários disponíveis para seus encontros."
      />
      {(await searchParams).save === "error" && (
        <Alert
          tone="error"
          title="Intervalo rejeitado"
          description="Confira sobreposição, datas futuras e encontros que dependem deste intervalo."
        />
      )}
      <div className="yas-split-layout">
        <div className="yas-split-main">
          <Card className="yas-stack">
            <SectionHeader title="Semana" />
            {slots.length === 0 ? (
              <EmptyState
                title="Nenhum horário cadastrado"
                description="Adicione um intervalo para abrir horários de encontro."
              />
            ) : (
              <ul className="yas-week">
                {WEEKDAYS.map((day) => {
                  const daySlots = slots.filter((slot) => weekdayKey(slot.starts_at) === day.key);
                  return (
                    <li className="yas-week-day" key={day.key}>
                      <strong>{day.label}</strong>
                      <div className="yas-week-chips">
                        {daySlots.length === 0 ? (
                          <span>Sem horários</span>
                        ) : (
                          daySlots.map((slot) => (
                            <span className="yas-week-chip" key={slot.id}>
                              {dateOf(slot.starts_at)} · {timeOf(slot.starts_at)} –{" "}
                              {timeOf(slot.ends_at)}
                            </span>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <div className="yas-split-aside">
          <Card className="yas-stack">
            <SectionHeader title="Novo horário" />
            <AvailabilitySlotForm operation="CREATE" />
          </Card>
          <Card>
            <div className="yas-queue-panel-heading">
              <h2>Intervalos</h2>
              <span className="yas-queue-count">{slots.length}</span>
            </div>
            {slots.map((item) => (
              <div className="yas-slot-row" key={item.id}>
                <div className="yas-slot-row-info">
                  <strong>
                    {WEEKDAYS.find((d) => d.key === weekdayKey(item.starts_at))?.label}{" "}
                    {dateOf(item.starts_at)}
                  </strong>
                  <span>
                    {timeOf(item.starts_at)} – {timeOf(item.ends_at)}
                  </span>
                  <Badge tone="muted">{duration(item.starts_at, item.ends_at)}</Badge>
                </div>
                <div className="yas-slot-row-actions">
                  <DetailDrawer
                    trigger="Editar intervalo"
                    triggerText="Editar"
                    triggerVariant="ghost"
                    triggerSize="sm"
                    title="Editar intervalo"
                  >
                    <AvailabilitySlotForm
                      id={item.id}
                      operation="EDIT"
                      startsAt={item.starts_at}
                      endsAt={item.ends_at}
                    />
                  </DetailDrawer>
                  <form action={saveAvailabilityAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="operation" value="DELETE" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label="Remover intervalo"
                      title="Remover intervalo"
                    >
                      ×
                    </Button>
                  </form>
                </div>
              </div>
            ))}
            <p className="yas-drawer-meta">
              Novos encontros só podem ser criados dentro destes intervalos.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
