"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { NoCohortNotice } from "./no-cohort-notice";

import {
  trackLessonStartedAction,
  updateLessonProgressAction,
} from "@/app/(protected)/(student)/aulas/actions";

export function LessonStartAnalytics({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void trackLessonStartedAction(lessonId);
  }, [lessonId]);

  return null;
}

export function LessonProgressControls({
  lessonId,
  currentPercent,
  estimatedMinutes,
  hasVideo = false,
}: {
  lessonId: string;
  currentPercent: number;
  estimatedMinutes: number | null;
  hasVideo?: boolean;
}) {
  const [noCohort, setNoCohort] = useState(false);
  const checkpoints = [25, 50, 75, 100] as const;
  const durationSeconds = Math.max((estimatedMinutes ?? 10) * 60, 1);

  return (
    <div className="yas-learning-checkpoints" aria-label="Atualizar progresso">
      {noCohort && <NoCohortNotice />}
      {checkpoints.map((percent) => (
        <form
          key={percent}
          action={async (formData: FormData) => {
            const result = await updateLessonProgressAction(formData);
            if (result?.noCohort) setNoCohort(true);
          }}
        >
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="completionPercent" value={percent} />
          <input
            type="hidden"
            name="lastPositionSeconds"
            value={hasVideo ? "" : Math.round((durationSeconds * percent) / 100)}
          />
          <Button
            type="submit"
            variant={percent === 100 ? "primary" : "outline"}
            disabled={currentPercent >= percent}
          >
            {percent === 100 ? "Concluir aula" : `Marcar ${percent}%`}
          </Button>
        </form>
      ))}
    </div>
  );
}
