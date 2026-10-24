"use client";
import Link from "next/link";
import { Avatar, Badge, Icon, ProgressBar, type IconName } from "@/components/ui";
import { initials } from "../domain/session-calendar";
import {
  attentionReasons,
  ENROLLMENT_LABELS,
  studentDate,
  type StudentEnrollment,
  type StudentEvent,
  type StudentRow,
} from "../domain/student-workspace";
import styles from "./students.module.css";

export const eventIcons: Record<StudentEvent["kind"], IconName> = {
  lesson: "book",
  practice: "pen",
  assessment: "file",
  session: "video",
};
export function StudentIdentity({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span aria-hidden="true">
      <Avatar label={name} fallback={initials(name)} size={large ? "lg" : "md"} />
    </span>
  );
}
export function StudentProgress({
  enrollment,
}: {
  enrollment: StudentEnrollment | null | undefined;
}) {
  if (enrollment?.progress == null)
    return <span className={styles.muted}>Sem progresso disponível</span>;
  return (
    <div className={styles.progress}>
      <ProgressBar
        value={enrollment.progress}
        label={`Progresso em ${enrollment.title}`}
        showLabel={false}
        showValue={false}
      />
      <strong>{enrollment.progress}%</strong>
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
        <Badge tone={student.last_activity ? "success" : "neutral"} dot>
          {student.last_activity ? "Em dia" : "Sem atividade"}
        </Badge>
      ) : (
        <Badge tone="neutral">
          {student.enrollments.some((item) => item.status === "COMPLETED")
            ? "Cursos concluídos"
            : "Sem matrícula ativa"}
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
    <Badge tone={enrollment.status === "ACTIVE" ? "success" : "neutral"}>
      {ENROLLMENT_LABELS[enrollment.status] ?? "Matrícula registrada"}
    </Badge>
  );
}
export function StudentEventList({
  events,
  profileHref,
}: {
  events: readonly StudentEvent[];
  profileHref?: (id: string) => string;
}) {
  if (!events.length)
    return <p className={styles.emptySmall}>Nenhuma atividade registrada neste período.</p>;
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
