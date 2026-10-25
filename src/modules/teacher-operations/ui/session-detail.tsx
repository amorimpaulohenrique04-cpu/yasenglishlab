import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ui";
import {
  teacherAttendanceLabel,
  teacherSessionTypeLabel,
  type TeacherRosterRecord,
} from "../domain/models";
import { localParts, type WorkspaceSession } from "../domain/session-workspace";
import { formatDay, formatDuration, initials, sessionMinutes } from "../domain/session-calendar";
import { ResourceAccess } from "./resource-access";
import { SessionStatusPill, SessionTypeIcon } from "./session-bits";
import styles from "./sessions.module.css";

export type TeacherResource = {
  id: string;
  resource_type: string;
  title: string;
  instructions: string;
  due_at: string | null;
  material_id: string | null;
  practice_activity_id: string | null;
  external_url: string | null;
  has_file?: boolean;
};

function Meta({
  icon,
  label,
  value,
  hint,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.meta}>
      <Icon name={icon} size={20} />
      <dl>
        <dt className="sr-only">{label}</dt>
        <dd>
          <strong>{value}</strong>
          {hint && <small>{hint}</small>}
        </dd>
      </dl>
    </div>
  );
}

export function SessionDetailHeader({ session, now }: { session: WorkspaceSession; now: number }) {
  const start = localParts(session.starts_at),
    end = localParts(session.ends_at);
  const minutes = sessionMinutes(session);
  const audience =
    session.cohort_name ??
    (session.session_type === "PRIVATE_SESSION" ? "Sessão individual" : "Sem turma");
  return (
    <header className={styles.hero}>
      <div className={styles.heroMain}>
        <SessionTypeIcon type={session.session_type} size="lg" />
        <div className={styles.heroTitle}>
          <span className={styles.eyebrow}>{teacherSessionTypeLabel(session.session_type)}</span>
          <div className={styles.heroHeading}>
            <h1>{session.title}</h1>
            <SessionStatusPill session={session} now={now} />
          </div>
        </div>
      </div>
      <div className={styles.metaStrip}>
        <Meta
          icon="cal"
          label="Data"
          value={formatDay(start.date, "weekday").replace(/^./, (c) =>
            c.toLocaleUpperCase("pt-BR"),
          )}
          hint={formatDay(start.date, "long")}
        />
        <Meta
          icon="clock"
          label="Horário"
          value={`${start.time} – ${end.date !== start.date ? `${formatDay(end.date, "short")} ` : ""}${end.time}`}
          hint={formatDuration(minutes)}
        />
        <Meta icon="monitor" label="Formato" value="Online" hint="America/Recife" />
        <Meta
          icon="layers"
          label={session.session_type === "PRIVATE_SESSION" ? "Aluno" : "Turma"}
          value={audience}
          hint={session.session_type === "PRIVATE_SESSION" ? "Aula individual" : "Turma"}
        />
        <Meta
          icon="users"
          label="Participantes"
          value={`${session.participant_count} de ${session.capacity}`}
          hint="Reservas ativas"
        />
      </div>
    </header>
  );
}

const resourceKind = (
  resource: TeacherResource,
): { icon: IconName; label: string; tone: string } =>
  resource.resource_type === "HOMEWORK"
    ? { icon: "check-c", label: "Tarefa", tone: "yellow" }
    : resource.has_file
      ? { icon: "file", label: "Arquivo", tone: "red" }
      : resource.external_url
        ? { icon: "link", label: "Link externo", tone: "blue" }
        : resource.practice_activity_id
          ? { icon: "target", label: "Prática", tone: "green" }
          : resource.material_id
            ? { icon: "book", label: "Material", tone: "lilac" }
            : { icon: "pen", label: "Instruções", tone: "lilac" };

export function ResourceGrid({
  resources,
  action,
  limit,
}: {
  resources: readonly TeacherResource[];
  action: (id: string) => Promise<string>;
  limit?: number;
}) {
  const list = limit ? resources.slice(0, limit) : resources;
  return (
    <ul className={styles.resourceGrid}>
      {list.map((resource, index) => {
        const kind = resourceKind(resource);
        return (
          <li
            key={resource.id}
            className={`${styles.resourceCard} yas-reveal`}
            style={{ "--yas-i": Math.min(index, 6) } as CSSProperties}
          >
            <span className={styles.resourceIcon} data-tone={kind.tone} aria-hidden="true">
              <Icon name={kind.icon} size={20} />
            </span>
            <div className={styles.resourceText}>
              <h3>{resource.title}</h3>
              <small>
                {kind.label}
                {resource.due_at &&
                  ` · prazo ${formatDay(localParts(resource.due_at).date, "short")}, ${localParts(resource.due_at).time}`}
              </small>
              {!limit && resource.instructions && <p>{resource.instructions}</p>}
            </div>
            {(resource.material_id ||
              resource.practice_activity_id ||
              resource.external_url ||
              resource.has_file) && <ResourceAccess id={resource.id} action={action} />}
          </li>
        );
      })}
    </ul>
  );
}

export function RosterPreview({
  roster,
  href,
}: {
  roster: readonly TeacherRosterRecord[];
  href: string;
}) {
  return (
    <section className={styles.panel} aria-labelledby="roster-preview-title">
      <header className={styles.panelHeader}>
        <h2 id="roster-preview-title">
          <Icon name="users" size={18} /> Quem participa ({roster.length})
        </h2>
        {roster.length > 0 && (
          <Link href={href} className={styles.sideLink} scroll={false}>
            Ver todos <Icon name="arrow" size={15} />
          </Link>
        )}
      </header>
      {roster.length === 0 ? (
        <p className={styles.muted}>Esta sessão ainda não possui reservas.</p>
      ) : (
        <ul className={styles.previewList}>
          {roster.slice(0, 5).map((person, index) => (
            <li key={person.bookingId}>
              <span className={styles.personAvatar} data-tone={index % 4} aria-hidden="true">
                {initials(person.displayName)}
              </span>
              <span className={styles.previewName}>{person.displayName}</span>
              <span
                className={styles.previewState}
                data-state={person.attendanceStatus ?? person.bookingStatus}
              >
                {person.bookingStatus === "BOOKED"
                  ? person.attendanceStatus
                    ? teacherAttendanceLabel(person.attendanceStatus)
                    : "Confirmado"
                  : "Reserva cancelada"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
