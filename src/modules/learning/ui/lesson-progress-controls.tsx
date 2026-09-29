"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

import { trackLessonStartedAction, updateLessonProgressAction } from "@/app/(protected)/(student)/aulas/actions";

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
}: {
  lessonId: string;
  currentPercent: number;
  estimatedMinutes: number | null;
}) {
  const checkpoints = [25, 50, 75, 100] as const;
  const durationSeconds = Math.max((estimatedMinutes ?? 10) * 60, 1);

  return (
    <div className="yas-learning-checkpoints" aria-label="Atualizar progresso">
      {checkpoints.map((percent) => (
        <form key={percent} action={updateLessonProgressAction}>
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="completionPercent" value={percent} />
          <input
            type="hidden"
            name="lastPositionSeconds"
            value={Math.round((durationSeconds * percent) / 100)}
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
