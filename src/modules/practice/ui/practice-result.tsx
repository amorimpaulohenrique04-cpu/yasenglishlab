import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui";

import { outcomeTitle, type PlayerOutcome } from "./practice-player-logic";

type OutcomeStatus = PlayerOutcome["status"];

const VISUAL: Record<OutcomeStatus, { icon: IconName; tone: string; lead: string }> = {
  CORRECT: { icon: "trophy", tone: "success", lead: "Mandou bem! Continue no ritmo." },
  INCORRECT: {
    icon: "redo",
    tone: "warning",
    // Convida a reprocessar o erro, não a passar adiante (Metcalfe, 2017).
    lead: "Errar faz parte. Leia com atenção o porquê e diga a forma certa em voz alta antes de seguir.",
  },
  PENDING_MANUAL: {
    icon: "clock",
    tone: "info",
    lead: "Sua resposta foi enviada e não recebe nota automática. O professor vai revisar.",
  },
  MANUAL_REVIEWED: { icon: "spark", tone: "info", lead: "Seu professor revisou esta prática." },
  NOT_SCORED: { icon: "check-c", tone: "info", lead: "Sua resposta foi registrada." },
};

/**
 * Tela de resultado de uma prática (servidor e player usam a mesma peça). O status nunca é
 * comunicado só por cor: ícone + título + texto.
 */
export function PracticeResultHero({
  status,
  feedback,
  titleId,
  activityTitle,
  children,
}: {
  status: OutcomeStatus;
  feedback?: string | null | undefined;
  titleId?: string;
  activityTitle?: string;
  children?: ReactNode;
}) {
  const visual = VISUAL[status];
  return (
    <div className="yas-practice-outcome" data-tone={visual.tone}>
      <span className="yas-practice-outcome-icon" aria-hidden="true">
        <Icon name={visual.icon} size={30} />
      </span>
      {activityTitle && <span className="yas-practice-outcome-kicker">{activityTitle}</span>}
      <h2 id={titleId}>{outcomeTitle(status)}</h2>
      <p className="yas-practice-outcome-lead">{visual.lead}</p>
      {feedback && (
        <div className="yas-practice-outcome-feedback">
          <span>
            <Icon name="chat" size={16} />
            Feedback
          </span>
          <p>{feedback}</p>
        </div>
      )}
      {children}
      <p className="yas-practice-boundary-note">
        <Icon name="spark" size={16} />
        Este resultado pertence somente à prática. Ele não altera seu progresso no curso nem define
        proficiência CEFR.
      </p>
    </div>
  );
}
