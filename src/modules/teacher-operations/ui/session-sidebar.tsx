"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/motion";
import { Icon, type IconName } from "@/components/ui";
import type { SessionWorkspace } from "../domain/session-workspace";
import type { SessionRowLinks } from "./session-row";
import { AvailabilitySheet, MeetingSheet } from "./session-sheets";
import styles from "./sessions.module.css";

const oneDecimal = (value: number) =>
  `${(Math.round(value * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;

export function WeekSummary({
  sessions,
  students,
  hours,
  range,
  weekHref,
}: {
  sessions: number;
  students: number;
  hours: number;
  range: string;
  weekHref: string;
}) {
  const stats: { icon: IconName; tone: string; value: ReactNode; label: string }[] = [
    {
      icon: "cal",
      tone: "lilac",
      value: <AnimatedNumber value={sessions} />,
      label: sessions === 1 ? "sessão" : "sessões",
    },
    {
      icon: "users",
      tone: "green",
      value: <AnimatedNumber value={students} />,
      label: students === 1 ? "aluno" : "alunos",
    },
    {
      icon: "clock",
      tone: "blue",
      value: <AnimatedNumber value={hours} format={oneDecimal} />,
      label: "de aula",
    },
  ];
  return (
    <section className={styles.sideCard} aria-labelledby="week-summary-title">
      <header className={styles.sideHeader}>
        <h2 id="week-summary-title">Resumo da semana</h2>
        <Link href={weekHref} className={styles.sideLink} scroll={false}>
          Ver semana <Icon name="arrow" size={15} />
        </Link>
      </header>
      <p className={styles.sideRange}>{range}</p>
      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label + stat.icon} className={styles.stat}>
            <span className={styles.statIcon} data-tone={stat.tone} aria-hidden="true">
              <Icon name={stat.icon} size={18} />
            </span>
            <dt className="sr-only">{stat.label === "de aula" ? "Horas previstas" : stat.label}</dt>
            <dd>
              <strong>{stat.value}</strong>
              <small aria-hidden="true">{stat.label}</small>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActionRow({
  icon,
  title,
  description,
  href,
  onClick,
}: {
  icon: IconName;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const descriptionId = useId();
  const inner = (
    <>
      <span className={styles.actionIcon} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className={styles.actionText}>
        <strong>{title}</strong>
        <small id={descriptionId}>{description}</small>
      </span>
      <Icon name="right" size={16} className={styles.actionChevron} />
    </>
  );
  return href ? (
    <Link href={href} className={styles.action} aria-label={title} aria-describedby={descriptionId}>
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      className={styles.action}
      onClick={onClick}
      aria-label={title}
      aria-describedby={descriptionId}
    >
      {inner}
    </button>
  );
}

export function QuickActions({
  context,
  now,
  date,
  today,
  returnTo,
  links,
  names,
  initialPanel,
}: {
  context: SessionWorkspace;
  now: number;
  date: string;
  today: string;
  returnTo: string;
  links: Readonly<Record<string, SessionRowLinks>>;
  names: Readonly<Record<string, string>>;
  initialPanel?: "availability" | "meeting" | undefined;
}) {
  const [panel, setPanel] = useState<"availability" | "meeting" | null>(initialPanel ?? null);
  return (
    <section className={styles.sideCard} aria-labelledby="quick-actions-title">
      <header className={styles.sideHeader}>
        <h2 id="quick-actions-title">
          <span className={styles.boltIcon} aria-hidden="true">
            <Icon name="bolt" size={16} />
          </span>
          Ações rápidas
        </h2>
      </header>
      <div className={styles.actions}>
        <ActionRow
          icon="plus"
          title="Criar sessão"
          description="Agende um novo encontro"
          href={`/teacher/sessoes/nova?returnTo=${encodeURIComponent(returnTo)}`}
        />
        <ActionRow
          icon="link"
          title="Cadastrar link do Meet"
          description="Vincule a sala de uma sessão"
          onClick={() => setPanel("meeting")}
        />
        <ActionRow
          icon="cal"
          title="Consultar disponibilidade"
          description="Horários livres da semana"
          onClick={() => setPanel("availability")}
        />
        <ActionRow
          icon="bars"
          title="Ver relatórios"
          description="Presença e participação"
          href="/teacher/sessoes/relatorios"
        />
      </div>
      <MeetingSheet
        open={panel === "meeting"}
        onOpenChange={(open) => setPanel(open ? "meeting" : null)}
        sessions={context.sessions}
        now={now}
      />
      <AvailabilitySheet
        open={panel === "availability"}
        onOpenChange={(open) => setPanel(open ? "availability" : null)}
        context={context}
        now={now}
        date={date}
        today={today}
        returnTo={returnTo}
        links={links}
        names={names}
      />
    </section>
  );
}
