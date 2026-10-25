"use client";
import Link from "next/link";
import { Avatar, AvatarStack, Badge, Icon, ProgressBar, type IconName } from "@/components/ui";
import { initials } from "../domain/session-calendar";
import {
  attentionReasons,
  groupStudentEvents,
  groupedEventTitle,
  studentAdministrativeLabel,
  studentEngagementLabel,
  studentEngagementState,
  studentPendingItems,
  studentRelativeDate,
  uniqueEventStudents,
  ENROLLMENT_LABELS,
  studentDate,
  type StudentEnrollment,
  type StudentEvent,
  type StudentPendingKey,
  type StudentRow,
} from "../domain/student-workspace";
import styles from "./students.module.css";

export const eventIcons: Record<StudentEvent["kind"], IconName> = {
  lesson: "book",
  practice: "pen",
  assessment: "file",
  session: "video",
};
const pendingIcons: Record<StudentPendingKey, IconName> = {
  entry: "file",
  practice: "pen",
  reassessment: "redo",
};
export function StudentIdentity({
  name,
  large = false,
  size,
}: {
  name: string;
  large?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span aria-hidden="true">
      <Avatar
        label={name}
        fallback={initials(name)}
        size={size ?? (large ? "lg" : "md")}
        tone="neutral"
      />
    </span>
  );
}
export function StudentProgress({
  enrollment,
  lessons = false,
}: {
  enrollment: StudentEnrollment | null | undefined;
  /** Compact list variant: short bar and a "completed/total aulas" line. */
  lessons?: boolean;
}) {
  if (enrollment?.progress == null)
    return (
      <span
        className={styles.muted}
        role="img"
        aria-label="Sem progresso disponível"
        title="Sem progresso disponível"
      >
        —
      </span>
    );
  const bar = (
    <div className={lessons ? styles.progressCompact : styles.progress}>
      <ProgressBar
        value={enrollment.progress}
        label={`Progresso em ${enrollment.title}`}
        showLabel={false}
        showValue={false}
      />
      <strong>{enrollment.progress}%</strong>
    </div>
  );
  if (!lessons) return bar;
  return (
    <div className={styles.progressCell}>
      {bar}
      <small>
        {enrollment.completed}/{enrollment.total} aulas
      </small>
    </div>
  );
}
export function StudentAttention({ student }: { student: StudentRow }) {
  const reasons = attentionReasons(student);
  return (
    <div className={styles.statuses}>
      {reasons.length ? (
        <>
          <Badge tone="warning" dot>
            Atenção
          </Badge>
          {reasons.map((reason) => (
            <small key={reason} className={styles.muted}>
              {reason}
            </small>
          ))}
        </>
      ) : student.enrollments.some((item) => item.status === "ACTIVE") ? (
        <Badge tone={student.last_activity ? "success" : "muted"} dot>
          {student.last_activity ? "Em dia" : "Sem atividade"}
        </Badge>
      ) : (
        <Badge tone="muted">
          {student.enrollments.some((item) => item.status === "COMPLETED")
            ? "Cursos concluídos"
            : "Sem matrícula ativa"}
        </Badge>
      )}
    </div>
  );
}
export function StudentAdministrative({
  student,
  showCourse = false,
}: {
  student: StudentRow;
  /** List variant: the primary course sits under the cohort. */
  showCourse?: boolean;
}) {
  const label = studentAdministrativeLabel(student);
  const waiting = label === "Aguardando turma" || label === "Em nivelamento";
  const hasCohort = !waiting && label !== "Sem matrícula" && label !== "Cursos concluídos";
  const value = hasCohort ? (
    <span className={styles.cohortName} title={label}>
      {label}
    </span>
  ) : (
    <Badge tone={label === "Em nivelamento" ? "info" : "muted"}>{label}</Badge>
  );
  const course = showCourse ? student.primary_enrollment?.title : undefined;
  if (!showCourse) return value;
  return (
    <div className={styles.adminCell}>
      {value}
      {course && <small>{course}</small>}
    </div>
  );
}
export function StudentEngagement({
  student,
  pulse = false,
}: {
  student: StudentRow;
  /** Soft pulsing dot (static under reduced motion). */
  pulse?: boolean;
}) {
  const state = studentEngagementState(student);
  if (state.tone === "none")
    return (
      <span className={styles.muted} aria-label="Sem matrícula ativa">
        —
      </span>
    );
  return (
    <span
      className={styles.engagement}
      data-tone={state.tone}
      data-pulse={pulse || undefined}
      title={studentEngagementLabel(student)}
    >
      {state.label}
    </span>
  );
}
export function StudentPending({ student }: { student: StudentRow }) {
  const items = studentPendingItems(student);
  if (!items.length)
    return (
      <span className={styles.muted} aria-label="Sem pendências">
        —
      </span>
    );
  const rest = items.slice(2);
  return (
    <div className={styles.statuses}>
      {items.slice(0, 2).map((item) => (
        <Badge
          key={item.key}
          tone={item.key === "reassessment" ? "warning" : "info"}
          icon={pendingIcons[item.key]}
        >
          {item.label}
        </Badge>
      ))}
      {rest.length > 0 && (
        <Badge tone="muted" title={rest.map((item) => item.label).join(", ")}>
          <span aria-hidden="true">+{rest.length}</span>
          <span className={styles.srOnly}>{rest.map((item) => item.label).join(", ")}</span>
        </Badge>
      )}
    </div>
  );
}
export function EnrollmentContext({
  enrollment,
  extra = 0,
}: {
  enrollment: StudentEnrollment | null | undefined;
  extra?: number;
}) {
  return (
    <div className={styles.context}>
      <strong>
        {enrollment?.cohorts.map((item) => item.name).join(" · ") || "Sem turma ativa"}
      </strong>
      <span>
        {enrollment?.title ?? "Sem matrícula"}
        {extra > 0 ? ` · +${extra} ${extra === 1 ? "curso" : "cursos"}` : ""}
      </span>
    </div>
  );
}
export function EnrollmentStatus({ enrollment }: { enrollment: StudentEnrollment }) {
  return (
    <Badge tone={enrollment.status === "ACTIVE" ? "success" : "muted"}>
      {ENROLLMENT_LABELS[enrollment.status] ?? "Matrícula registrada"}
    </Badge>
  );
}
export function StudentEventList({
  events,
  profileHref,
  grouped = false,
  limit = 4,
}: {
  events: readonly StudentEvent[];
  profileHref?: ((id: string) => string) | undefined;
  /** Maximum grouped rows. */
  limit?: number;
  /** Listing feed only: same-day repeats collapse into one row, at most 4 rows. */
  grouped?: boolean;
}) {
  if (!events.length)
    return <p className={styles.emptySmall}>Nenhuma atividade registrada neste período.</p>;
  if (grouped) return <GroupedEventList events={events} profileHref={profileHref} limit={limit} />;
  return (
    <ol className={styles.eventList}>
      {events.map((event) => (
        <li key={event.id}>
          <span className={styles.eventIcon} data-kind={event.kind} aria-hidden="true">
            <Icon name={eventIcons[event.kind]} size={18} />
          </span>
          <div>
            {event.student_name && event.student_id && profileHref ? (
              <Link className={styles.eventStudent} href={profileHref(event.student_id)}>
                {event.student_name}
              </Link>
            ) : null}
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
            <time dateTime={event.occurred_at}>{studentDate(event.occurred_at)}</time>
            {event.session_id && (
              <Link className={styles.textLink} href={`/teacher/sessoes/${event.session_id}`}>
                Ver sessão <Icon name="arrow" size={13} />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
function StudentName({
  student,
  profileHref,
}: {
  student: { id: string; name: string };
  profileHref?: ((id: string) => string) | undefined;
}) {
  return profileHref ? (
    <Link className={styles.eventStudent} href={profileHref(student.id)}>
      {student.name}
    </Link>
  ) : (
    <>{student.name}</>
  );
}
function GroupedEventList({
  events,
  profileHref,
  limit,
}: {
  limit: number;
  events: readonly StudentEvent[];
  profileHref?: ((id: string) => string) | undefined;
}) {
  return (
    <ol className={styles.feed}>
      {groupStudentEvents(events, limit).map((group) => {
        const students = uniqueEventStudents(group.events);
        const many = group.events.length > 1;
        const heading = many
          ? groupedEventTitle(group.title, group.detail, group.events.length)
          : null;
        const first = students[0];
        const time = (
          <time className={styles.timeChip} dateTime={group.occurred_at}>
            {studentRelativeDate(group.occurred_at)}
          </time>
        );
        const names = students.map((student) => student.name).join(", ");
        return (
          <li key={group.key}>
            <span className={styles.feedIcon} data-kind={group.kind} aria-hidden="true">
              <Icon name={eventIcons[group.kind]} size={15} />
            </span>
            <div>
              {heading ? (
                <>
                  <span className={styles.feedHead}>
                    <strong>{heading.title}</strong>
                    {time}
                  </span>
                  {heading.detail && <span>{heading.detail}</span>}
                  {students.length > 0 && (
                    <span className={styles.feedAvatars}>
                      <AvatarStack label={`Alunos: ${names}`}>
                        {students.slice(0, 3).map((student) => {
                          const avatar = (
                            <Avatar
                              label={student.name}
                              fallback={initials(student.name)}
                              size="sm"
                              tone="neutral"
                            />
                          );
                          return profileHref ? (
                            <Link
                              key={student.id}
                              href={profileHref(student.id)}
                              aria-label={`Abrir perfil de ${student.name}`}
                              title={student.name}
                            >
                              {avatar}
                            </Link>
                          ) : (
                            <span key={student.id} title={student.name}>
                              {avatar}
                            </span>
                          );
                        })}
                      </AvatarStack>
                      {students.length > 3 && (
                        <span className={styles.avatarMore} title={names}>
                          +{students.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className={styles.feedHead}>
                    <strong>
                      {first ? (
                        <>
                          <StudentName student={first} profileHref={profileHref} /> ·{" "}
                        </>
                      ) : null}
                      {group.title}
                    </strong>
                    {time}
                  </span>
                  {group.detail && <span>{group.detail}</span>}
                  {group.events[0]?.session_id && (
                    <Link
                      className={styles.textLink}
                      href={`/teacher/sessoes/${group.events[0].session_id}`}
                    >
                      Ver sessão <Icon name="arrow" size={13} />
                    </Link>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function StudentPagination({
  page,
  total,
  pageSize,
  href,
  onPage,
  label = "registros",
}: {
  page: number;
  total: number;
  pageSize: number;
  href?: (page: number) => string;
  onPage?: (page: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n > 0 && n <= pages)
    .sort((a, b) => a - b);
  const item = (n: number, text: React.ReactNode, disabled: boolean, accessible?: string) =>
    href && !disabled ? (
      <Link
        href={href(n)}
        scroll={false}
        className={styles.pageButton}
        aria-label={accessible}
        aria-current={n === page && !accessible ? "page" : undefined}
      >
        {text}
      </Link>
    ) : (
      <button
        type="button"
        className={styles.pageButton}
        disabled={disabled}
        onClick={() => onPage?.(n)}
        aria-label={accessible}
        aria-current={n === page && !accessible ? "page" : undefined}
      >
        {text}
      </button>
    );
  return (
    <footer className={styles.pagination}>
      <span>
        {total
          ? `Exibindo ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total} ${label}`
          : `0 ${label}`}
      </span>
      <nav aria-label="Paginação">
        {item(page - 1, <Icon name="left" size={16} />, page <= 1, "Página anterior")}
        {numbers.map((n, i) => (
          <span key={n} className={styles.pageNumber}>
            {i > 0 && n - numbers[i - 1]! > 1 ? <span aria-hidden="true">…</span> : null}
            {item(n, n, false)}
          </span>
        ))}
        {item(page + 1, <Icon name="right" size={16} />, page >= pages, "Próxima página")}
      </nav>
    </footer>
  );
}
