import { Icon, type IconName } from "@/components/ui";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "../domain/models";
import { initials } from "../domain/session-calendar";
import type { WorkspaceSession } from "../domain/session-workspace";
import styles from "./sessions.module.css";

type SessionType = WorkspaceSession["session_type"];

export const sessionTypeMeta: Record<SessionType, { icon: IconName; description: string }> = {
  CORE_CLASS: { icon: "grad", description: "Aula regular do curso" },
  CONVERSATION_LAB: { icon: "chat", description: "Conversação em grupo" },
  PRIVATE_SESSION: { icon: "user", description: "Aula individual personalizada" },
  WORKSHOP: { icon: "users", description: "Aula temática em grupo" },
};

export function SessionTypeChip({ type }: { type: SessionType }) {
  return (
    <span className={styles.type} data-type={type}>
      {teacherSessionTypeLabel(type)}
    </span>
  );
}

export function SessionTypeIcon({ type, size = "md" }: { type: SessionType; size?: "md" | "lg" }) {
  return (
    <span className={styles.typeIcon} data-type={type} data-size={size} aria-hidden="true">
      <Icon name={sessionTypeMeta[type].icon} size={size === "lg" ? 26 : 18} />
    </span>
  );
}

export function SessionStatusPill({
  session,
  now,
}: {
  session: Pick<WorkspaceSession, "status" | "starts_at" | "ends_at">;
  now: number;
}) {
  const live =
    session.status === "SCHEDULED" &&
    Date.parse(session.starts_at) <= now &&
    Date.parse(session.ends_at) > now;
  const state = live ? "LIVE" : session.status;
  return (
    <span className={styles.status} data-status={state}>
      <span className={styles.statusDot} aria-hidden="true" />
      {live ? "Em andamento" : teacherSessionStatusLabel(session.status)}
    </span>
  );
}

export function ParticipantAvatars({
  ids,
  names,
  max = 3,
}: {
  ids: readonly string[];
  names: Readonly<Record<string, string>>;
  max?: number;
}) {
  const known = ids.map((id) => names[id]).filter((name): name is string => Boolean(name));
  const count = ids.length;
  const label = `${count} ${count === 1 ? "participante" : "participantes"}`;
  return (
    <span className={styles.people}>
      {known.length > 0 && (
        <span className={styles.avatars} aria-hidden="true">
          {known.slice(0, max).map((name, index) => (
            <span key={`${name}-${index}`} className={styles.avatar} data-tone={index % 4}>
              {initials(name)}
            </span>
          ))}
          {known.length > max && (
            <span className={styles.avatar} data-tone="more">
              +{known.length - max}
            </span>
          )}
        </span>
      )}
      <span>{count === 0 ? "Sem participantes" : label}</span>
    </span>
  );
}
