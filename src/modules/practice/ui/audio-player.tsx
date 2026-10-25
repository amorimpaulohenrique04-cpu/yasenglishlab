"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import styles from "./audio-player.module.css";

const SPEEDS = [1, 1.25, 1.5, 0.75] as const;
const BARS = 56;

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Decorative, deterministic bar heights per recording (not a real waveform). */
function bars(seed: string) {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + i;
    const wave = Math.sin(i / 4.5) * 0.25 + 0.55;
    return Math.round((wave + ((h >>> 0) % 100) / 260) * 100) / 100;
  });
}

/**
 * Teacher-side player for a private practice recording. The signed URL is requested on mount
 * through `action` (the server re-checks the Teacher scope); `knownDuration` covers browser
 * recordings whose metadata reports no duration.
 */
export function AudioPlayer({
  id,
  action,
  knownDuration,
  className,
}: {
  id: string;
  action: (id: string) => Promise<string>;
  knownDuration?: number | null;
  className?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const heights = useMemo(() => bars(id), [id]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    action(id)
      .then((signed) => {
        if (!alive) return;
        setUrl(signed);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [action, id, attempt]);

  const toggle = () => {
    const node = audio.current;
    if (!node || state !== "ready") return;
    if (node.paused) void node.play().catch(() => setState("error"));
    else node.pause();
  };

  const seek = (seconds: number) => {
    const node = audio.current;
    if (!node) return;
    const end = duration || node.duration || 0;
    node.currentTime = Math.min(Math.max(0, seconds), end || seconds);
    setTime(node.currentTime);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === " " || event.key === "k") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(time + 5);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(time - 5);
    }
  };

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <div
      className={[styles.player, className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Resposta de áudio"
      data-state={state}
      data-playing={playing || undefined}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={styles.play}
        onClick={toggle}
        disabled={state !== "ready"}
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
          {playing ? (
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          ) : (
            <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z" />
          )}
        </svg>
      </button>
      <div className={styles.track}>
        <div className={styles.wave} aria-hidden="true">
          {heights.map((height, index) => (
            <span
              key={index}
              data-played={index / BARS < progress || undefined}
              style={{ "--h": height } as CSSProperties}
            />
          ))}
        </div>
        <input
          type="range"
          className={styles.scrubber}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={state !== "ready" || !duration}
          aria-label="Posição do áudio"
          aria-valuetext={`${clock(time)} de ${clock(duration)}`}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <div className={styles.meta}>
          <span className="yas-tabular">
            {clock(time)} <span aria-hidden="true">/</span>
            <span className="sr-only">de</span> {clock(duration)}
          </span>
          {state === "loading" && <span>Carregando áudio…</span>}
        </div>
      </div>
      <button
        type="button"
        className={styles.speed}
        aria-label={`Velocidade ${speed}x`}
        disabled={state !== "ready"}
        onClick={() => {
          const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >
        {speed.toLocaleString("pt-BR")}x
      </button>
      {state === "error" && (
        <p className={styles.error} role="status">
          Áudio indisponível.{" "}
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
            event.currentTarget.playbackRate = speed;
          }}
          onDurationChange={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          }}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setUrl(null);
            setState("error");
          }}
        />
      )}
    </div>
  );
}
