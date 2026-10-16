import Link from "next/link";

import { Badge, Icon, type IconName } from "@/components/ui";
import {
  isLessonComplete,
  lessonCompletion,
  lessonLockMessage,
  type LearningLesson,
} from "@/modules/learning";

export type LessonState = "done" | "current" | "in-progress" | "available" | "locked";

export function lessonState(lesson: LearningLesson, currentId: string | null): LessonState {
  if (lessonLockMessage(lesson)) return "locked";
  if (isLessonComplete(lesson)) return "done";
  if (lesson.id === currentId) return "current";
  if (lessonCompletion(lesson) > 0) return "in-progress";
  return "available";
}

const stateIcon: Record<LessonState, IconName> = {
  done: "check-c",
  current: "play-c",
  "in-progress": "play-c",
  available: "circle",
  locked: "lock",
};

const stateLabel: Record<LessonState, string> = {
  done: "Concluída",
  current: "Aula atual",
  "in-progress": "Em andamento",
  available: "Disponível",
  locked: "Bloqueada",
};

const stateTone = {
  done: "success",
  current: "neutral",
  "in-progress": "info",
  available: "muted",
  locked: "muted",
} as const;

/** Ação explícita da linha: convida a começar, continuar ou rever a aula. */
export function lessonAction(lesson: LearningLesson, state: LessonState) {
  const percent = lessonCompletion(lesson);
  const label =
    state === "done" || percent === 100
      ? "Rever aula →"
      : percent > 0
        ? "Continuar →"
        : state === "current"
          ? "Começar aula →"
          : "Abrir aula →";
  return { label, primary: state === "current" };
}

/** Linha de aula com estado por ícone + texto (nunca só cor). */
export function LessonRow({
  lesson,
  href,
  state,
  action,
}: {
  lesson: LearningLesson;
  href: string;
  state: LessonState;
  /** Ação explícita à direita; sem ela, o título é o link. */
  action?: { label: string; primary?: boolean };
}) {
  const lockMessage = lessonLockMessage(lesson);
  const percent = lessonCompletion(lesson);
  const label =
    state === "in-progress" || (state === "current" && percent > 0)
      ? `${percent}% concluído`
      : stateLabel[state];

  return (
    <li
      className="yas-lesson-row"
      data-state={state}
      aria-current={state === "current" ? "step" : undefined}
    >
      <span className="yas-lesson-row-icon" aria-hidden="true">
        <Icon name={stateIcon[state]} size={20} />
      </span>
      <span className="yas-lesson-row-number" aria-hidden="true">
        {String(lesson.position).padStart(2, "0")}
      </span>
      <span className="yas-lesson-row-title">
        {state === "locked" || action ? (
          <span>{lesson.title}</span>
        ) : (
          <Link className="yas-lesson-row-link" href={href}>
            {lesson.title}
          </Link>
        )}
        {lockMessage && <small>{lockMessage}</small>}
      </span>
      <span className="yas-lesson-row-duration">
        <Icon name="clock" size={15} />
        {lesson.estimatedMinutes ?? 10} min
      </span>
      <span className="yas-lesson-row-state">
        <Badge tone={stateTone[state]} icon={state === "locked" ? "lock" : undefined}>
          {label}
        </Badge>
      </span>
      {action && state !== "locked" && (
        <span className="yas-lesson-row-action">
          <Link
            className={`yas-button yas-button--sm ${action.primary ? "yas-button--secondary" : "yas-button--soft"}`}
            href={href}
          >
            {action.label}
          </Link>
        </span>
      )}
    </li>
  );
}
