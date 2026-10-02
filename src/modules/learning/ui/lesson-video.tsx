"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { VideoPlayback } from "@/modules/learning/application/video-provider";
import {
  lessonVideoPlaybackAction,
  checkpointVideoAction,
  lessonVideoAnalyticsAction,
} from "@/app/(protected)/(student)/aulas/video-actions";
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => <p>Carregando player…</p>,
});
export function LessonVideo({
  assetId,
  lessonId,
  position,
  completionPercent,
}: {
  assetId: string;
  lessonId: string;
  position: number | null;
  completionPercent: number;
}) {
  const [playback, setPlayback] = useState<VideoPlayback | null>(null);
  const [error, setError] = useState("");
  const player = useRef<import("@mux/mux-player-react").MuxPlayerRefAttributes | null>(null);
  const pending = useRef<{ position: number; ended: boolean } | null>(null);
  const saving = useRef(false);
  const saved = useRef(position ?? 0);
  const completed = useRef(completionPercent === 100);
  const started = useRef(false);
  const load = useCallback(async () => {
    try {
      setPlayback(await lessonVideoPlaybackAction(assetId));
      setError("");
    } catch {
      setError("Vídeo indisponível. Tente novamente.");
    }
  }, [assetId]);
  useEffect(() => {
    let active = true;
    lessonVideoPlaybackAction(assetId)
      .then((result) => {
        if (active) setPlayback(result);
      })
      .catch(() => {
        if (active) setError("Vídeo indisponível.");
      });
    return () => {
      active = false;
    };
  }, [assetId]);
  const flush = useCallback(
    async (ended = false) => {
      const seconds = player.current?.currentTime;
      if (!Number.isFinite(seconds) || seconds == null) return;
      const next = Math.floor(seconds);
      if (next <= saved.current && !ended) return;
      pending.current = {
        position: Math.max(next, saved.current),
        ended: ended || completed.current,
      };
      if (saving.current) return;
      saving.current = true;
      try {
        while (pending.current) {
          const checkpoint = pending.current;
          pending.current = null;
          await checkpointVideoAction(lessonId, checkpoint.position, checkpoint.ended);
          saved.current = checkpoint.position;
          completed.current ||= checkpoint.ended;
          if (ended) await lessonVideoAnalyticsAction(assetId, lessonId, "completed");
        }
      } catch {
        setError("Não foi possível salvar a posição. A próxima atualização tentará novamente.");
      } finally {
        saving.current = false;
      }
    },
    [lessonId, assetId],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (player.current && !player.current.paused) void flush();
    }, 15000);
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [flush]);
  useEffect(() => {
    if (!playback) return;
    const timer = setTimeout(
      () => {
        void load();
      },
      Math.max(1000, playback.expiresAt - Date.now() - 60000),
    );
    return () => clearTimeout(timer);
  }, [playback, load]);
  return (
    <div>
      <div role="status">{error}</div>
      {error && playback && <Button onClick={load}>Renovar acesso ao vídeo</Button>}
      {playback?.captions && (
        <p>
          {playback.captions.status === "READY"
            ? `Legendas disponíveis (${playback.captions.language}) no player.`
            : playback.captions.status === "PROCESSING"
              ? "Legendas em processamento."
              : "Legendas ainda indisponíveis."}
        </p>
      )}
      {!playback ? (
        <Button onClick={load}>Carregar vídeo</Button>
      ) : (
        <MuxPlayer
          ref={player}
          playbackId={playback.playbackId}
          tokens={playback.tokens}
          poster={`https://image.mux.com/${playback.playbackId}/thumbnail.jpg?token=${playback.tokens.thumbnail}`}
          accentColor="#6f45bb"
          style={{ width: "100%", aspectRatio: "16 / 9" }}
          onLoadedMetadata={() => {
            const element = player.current;
            if (
              element &&
              position != null &&
              Number.isFinite(position) &&
              position > 0 &&
              position < element.duration
            )
              element.currentTime = position;
          }}
          onPlay={() => {
            if (!started.current) {
              started.current = true;
              void lessonVideoAnalyticsAction(assetId, lessonId, "started");
              if (position != null && position > 0)
                void lessonVideoAnalyticsAction(assetId, lessonId, "resumed");
            }
          }}
          onPause={() => void flush()}
          onEnded={() => void flush(true)}
          onError={() => setError("Não foi possível reproduzir o vídeo. Recarregue o acesso.")}
        />
      )}
    </div>
  );
}
