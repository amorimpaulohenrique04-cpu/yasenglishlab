import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";

import { ErrorState, Icon } from "@/components/ui";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadLearningCourses } from "@/server/learning/canonical-slice";
import { loadPracticePage } from "@/server/practice/practice";

import { groupActivitiesByLesson } from "@/app/(protected)/(student)/pratica/_practice/grouping";
import { PracticeStage } from "@/app/(protected)/(student)/pratica/_practice/practice-stage";

interface PracticeAttemptPageProps {
  params: Promise<{ attemptId: string }>;
}

function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <div className="yas-practice-stage">
      <header className="yas-practice-stage-top">
        <Link className="yas-practice-stage-close" href="/pratica" aria-label="Fechar">
          <Icon name="x" size={20} />
        </Link>
      </header>
      <div className="yas-practice-stage-card">
        <ErrorState title={title} description={description} />
      </div>
    </div>
  );
}

/** Uma prática aberta, em tela própria: a tentativa é carregada e autorizada no servidor. */
export default async function PracticeAttemptPage({ params }: PracticeAttemptPageProps) {
  const { attemptId } = await params;
  const access = await loadCurrentSubscriptionAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-practice-stage">
        <SubscriptionSuspendedNotice access={access} context="practice" />
      </div>
    );
  }

  const state = await loadPracticePage({ attemptId });
  if (state.status !== "success" || !state.data.selectedAttempt) {
    return (
      <Unavailable
        title="Tentativa indisponível"
        description="Ela não existe ou não pertence à sua conta."
      />
    );
  }

  const learning = await loadLearningCourses().catch(() => null);
  const groups = groupActivitiesByLesson(
    state.data.activities,
    learning?.status === "success" ? learning.data : [],
    new Set(state.data.reachedActivityIds),
  );

  return (
    <StageTransition>
      <PracticeStage attempt={state.data.selectedAttempt} groups={groups} />
    </StageTransition>
  );
}

/** Entrar na prática "sobe ao palco"; sair devolve suavemente para a lista. */
function StageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="yas-stage-in" exit="yas-stage-out" default="none">
      {children}
    </ViewTransition>
  );
}
