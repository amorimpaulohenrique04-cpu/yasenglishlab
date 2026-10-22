"use client";

import { useId, useState } from "react";
import { formatDay } from "../domain/session-calendar";
import styles from "./sessions.module.css";

type Day = { date: string; scheduled: number; completed: number; cancelled: number };

const W = 640,
  H = 240,
  PAD = { top: 16, right: 12, bottom: 28, left: 30 };

/** Monotone-ish smooth path through the points (Catmull-Rom converted to cubic Béziers). */
function smooth(points: readonly [number, number][]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]![0]},${points[0]![1]}`;
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!,
      p1 = points[i]!,
      p2 = points[i + 1]!,
      p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const c1y = Math.min(
      Math.max(p1[1] + (p2[1] - p0[1]) * t, Math.min(p1[1], p2[1])),
      Math.max(p1[1], p2[1]),
    );
    const c2y = Math.min(
      Math.max(p2[1] - (p3[1] - p1[1]) * t, Math.min(p1[1], p2[1])),
      Math.max(p1[1], p2[1]),
    );
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${c1y} ${p2[0] - (p3[0] - p1[0]) * t},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const niceMax = (value: number) =>
  value <= 4 ? 4 : value <= 6 ? 6 : value <= 8 ? 8 : Math.ceil(value / 5) * 5;

export function SessionsAreaChart({ days }: { days: readonly Day[] }) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(
    Math.max(1, ...days.map((d) => Math.max(d.scheduled + d.completed, d.cancelled))),
  );
  const innerW = W - PAD.left - PAD.right,
    innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (days.length <= 1 ? innerW / 2 : (i * innerW) / (days.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const held = days.map((d, i) => [x(i), y(d.scheduled + d.completed)] as [number, number]);
  const done = days.map((d, i) => [x(i), y(d.completed)] as [number, number]);
  const line = smooth(held);
  const area = held.length ? `${line} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const ticks = [0, max / 2, max];
  const step = Math.max(1, Math.ceil(days.length / 7));
  const barW = Math.max(3, Math.min(10, innerW / Math.max(1, days.length) - 4));
  const active = hover === null ? null : days[hover];

  return (
    <div className={styles.chartBox}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chart}
        role="img"
        aria-label="Sessões por dia no período. Os valores completos estão na tabela “Ver valores por dia”."
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--yas-color-purple-600)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--yas-color-purple-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className={styles.gridLine}
            />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className={styles.axisText}>
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          d.cancelled > 0 ? (
            <rect
              key={`c-${d.date}`}
              x={x(i) - barW / 2}
              y={y(d.cancelled)}
              width={barW}
              height={y(0) - y(d.cancelled)}
              rx={2}
              className={styles.barCancelled}
            />
          ) : null,
        )}
        <path d={area} fill={`url(#${gradient})`} className={styles.chartArea} />
        <path d={line} pathLength={1} className={styles.lineHeld} />
        <path d={smooth(done)} className={styles.lineDone} />
        {days.map((d, i) =>
          i % step === 0 || i === days.length - 1 ? (
            <text
              key={`x-${d.date}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className={styles.axisText}
            >
              {d.date.slice(8)}/{d.date.slice(5, 7)}
            </text>
          ) : null,
        )}
        {active && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className={styles.crosshair} />
            <circle
              cx={x(hover)}
              cy={y(active.scheduled + active.completed)}
              r={5}
              className={styles.dotHeld}
            />
          </g>
        )}
        {days.map((d, i) => (
          <rect
            key={`h-${d.date}`}
            x={x(i) - innerW / Math.max(1, days.length) / 2}
            y={PAD.top}
            width={innerW / Math.max(1, days.length)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {active && hover !== null && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(active.scheduled + active.completed) / H) * 100}%`,
          }}
          aria-hidden="true"
        >
          <strong>{formatDay(active.date, "full")}</strong>
          <span data-series="held">Não canceladas: {active.scheduled + active.completed}</span>
          <span data-series="done">Concluídas: {active.completed}</span>
          <span data-series="cancelled">Canceladas: {active.cancelled}</span>
        </div>
      )}
    </div>
  );
}

const TYPE_ORDER = ["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION", "WORKSHOP"] as const;

export function TypeDonut({
  counts,
  labels,
}: {
  counts: Readonly<Record<(typeof TYPE_ORDER)[number], number>>;
  labels: Readonly<Record<(typeof TYPE_ORDER)[number], string>>;
}) {
  const total = TYPE_ORDER.reduce((n, type) => n + counts[type], 0);
  const radius = 64,
    stroke = 22,
    circumference = 2 * Math.PI * radius,
    gap = total > 1 ? 4 : 0;
  const lengths = TYPE_ORDER.map((type) => (total ? (counts[type] / total) * circumference : 0));
  const segments = TYPE_ORDER.map((type, index) => ({
    type,
    length: Math.max(0, lengths[index]! - gap),
    offset: lengths.slice(0, index).reduce((sum, value) => sum + value, 0),
  }));
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut}>
        <svg viewBox="0 0 180 180" role="img" aria-label={`${total} sessões no período, por tipo`}>
          <circle
            cx="90"
            cy="90"
            r={radius}
            className={styles.donutTrack}
            strokeWidth={stroke}
            fill="none"
          />
          {segments.map((segment, index) =>
            segment.length > 0 ? (
              <circle
                key={segment.type}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="butt"
                className={styles.donutSegment}
                data-series={segment.type}
                transform="rotate(-90 90 90)"
                strokeDasharray={`${segment.length} ${circumference}`}
                strokeDashoffset={-segment.offset}
                style={{ animationDelay: `${150 + index * 120}ms` }}
              />
            ) : null,
          )}
        </svg>
        <span className={styles.donutCenter} aria-hidden="true">
          <strong>{total}</strong>
          <small>{total === 1 ? "sessão" : "sessões"}</small>
        </span>
      </div>
      <ul className={styles.donutLegend}>
        {TYPE_ORDER.map((type) => (
          <li key={type}>
            <span className={styles.legendDot} data-series={type} aria-hidden="true" />
            <span>{labels[type]}</span>
            <strong>{counts[type]}</strong>
            <small>{total ? Math.round((counts[type] / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
