"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dropdown, Icon, type DropdownItem } from "@/components/ui";
import { localParts, type WorkspaceSession } from "../domain/session-workspace";
import { formatCountdown } from "../domain/session-calendar";
import {
  ParticipantAvatars,
  SessionStatusPill,
  SessionTypeChip,
  SessionTypeIcon,
} from "./session-bits";
import styles from "./sessions.module.css";

export interface SessionRowLinks {
  detail: string;
  canEdit: boolean;
  canCancel: boolean;
}

export function sessionMenuItems(session: WorkspaceSession, links: SessionRowLinks) {
  const items: DropdownItem[] = [
    { id: "open", label: "Ver detalhes e ações", href: links.detail, icon: "eye" },
  ];
  if (links.canEdit) {
    items.push(
      { id: "edit", label: "Editar sessão", href: `${links.detail}&edit=1`, icon: "pen" },
      {
        id: "meet",
        label: "Cadastrar link do Meet",
        href: `${links.detail}&meeting=1`,
        icon: "link",
      },
    );
  }
  if (links.canCancel)
    items.push({
      id: "cancel",
      label: "Cancelar sessão",
      href: `${links.detail}&cancel=1`,
      icon: "x-c",
      destructive: true,
    });
  return items;
}

/** One session inside a day group of the agenda. */
export function SessionRow({
  session,
  links,
  names,
  now,
}: {
  session: WorkspaceSession;
  links: SessionRowLinks;
  names: Readonly<Record<string, string>>;
  now: number;
}) {
  const title = (
    <h3 className={styles.rowTitle}>
      <Link href={links.detail} className={styles.stretched}>
        {session.title}
      </Link>
    </h3>
  );
  return (
    <article className={styles.row} data-type={session.session_type}>
      <div className={styles.rowTime}>
        <time dateTime={session.starts_at}>{localParts(session.starts_at).time}</time>
        <small>até {localParts(session.ends_at).time}</small>
      </div>
      <div className={styles.rowBody}>
        <SessionTypeChip type={session.session_type} />
        {title}
        <div className={styles.rowMeta}>
          <ParticipantAvatars ids={session.student_ids} names={names} />
          {session.cohort_name && (
            <span className={styles.metaItem}>
              <Icon name="layers" size={14} />
              {session.cohort_name}
            </span>
          )}
        </div>
      </div>
      <div className={styles.rowAside}>
        <SessionStatusPill session={session} now={now} />
        <Link className="yas-button yas-button--soft yas-button--sm" href={links.detail}>
          Abrir sessão
          <Icon name="arrow" size={16} />
        </Link>
        <Dropdown
          iconOnly
          label={`Ações de ${session.title}`}
          items={sessionMenuItems(session, links)}
        />
      </div>
    </article>
  );
}

/** Live countdown for the session that comes next (or is happening now). */
export function NextSessionCard({
  session,
  links,
  names,
  now: serverNow,
}: {
  session: WorkspaceSession;
  links: SessionRowLinks;
  names: Readonly<Record<string, string>>;
  now: number;
}) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const live = Date.parse(session.starts_at) <= now;
  const countdown = formatCountdown(Date.parse(session.starts_at) - now);
  const marked = session.attended_count + session.no_show_count;
  return (
    <section
      className={styles.nextCard}
      data-live={live || undefined}
      aria-labelledby="next-session-heading"
    >
      <header className={styles.nextHeader}>
        <span className={styles.nextIcon} aria-hidden="true">
          <Icon name="clock" size={18} />
        </span>
        <h2 id="next-session-heading">{live ? "Sessão em andamento" : "Próxima sessão"}</h2>
        <span className={styles.countdown} data-live={live || undefined} role="timer">
          {live && <span className={styles.livePulse} aria-hidden="true" />}
          {live ? "Ao vivo agora" : countdown}
        </span>
      </header>
      <div className={styles.nextBody}>
        <div className={styles.rowTime}>
          <time dateTime={session.starts_at}>{localParts(session.starts_at).time}</time>
          <small>até {localParts(session.ends_at).time}</small>
        </div>
        <SessionTypeIcon type={session.session_type} size="lg" />
        <div className={styles.rowBody}>
          <SessionTypeChip type={session.session_type} />
          <h3 className={styles.rowTitle}>{session.title}</h3>
          <div className={styles.rowMeta}>
            <ParticipantAvatars ids={session.student_ids} names={names} />
            <span className={styles.metaItem}>
              {marked} de {session.participant_count} presenças marcadas
            </span>
          </div>
        </div>
        <div className={styles.rowAside}>
          <Link className="yas-button yas-button--secondary" href={links.detail}>
            Abrir sessão
            <Icon name="arrow" size={16} />
          </Link>
          <Dropdown
            iconOnly
            label={`Ações de ${session.title}`}
            items={sessionMenuItems(session, links)}
          />
        </div>
      </div>
    </section>
  );
}
