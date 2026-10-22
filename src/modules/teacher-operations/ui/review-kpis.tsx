"use client";

import type { CSSProperties } from "react";
import { AnimatedNumber } from "@/components/motion";
import { Icon, type IconName } from "@/components/ui";
import { formatMinutes, reviewDelta } from "../domain/review-queue";
import styles from "./reviews.module.css";

const count = (n: number) => Math.round(n).toLocaleString("pt-BR");
const minutes = (n: number) => formatMinutes(n) ?? "—";

function Kpi({
  label,
  icon,
  tone,
  value,
  unit = "count",
  note,
  delta,
  index,
}: {
  label: string;
  icon: IconName;
  tone: string;
  value: number | null;
  unit?: "count" | "minutes";
  note: string;
  delta?: { label: string; tone: "positive" | "negative" | "neutral"; direction: string } | null;
  index: number;
}) {
  return (
    <section className={`${styles.kpi} yas-reveal`} style={{ "--yas-i": index } as CSSProperties}>
      <span className={styles.kpiIcon} data-tone={tone} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.kpiBody}>
        <h2>{label}</h2>
        <div className={styles.kpiValueRow}>
          <strong className={styles.kpiValue}>
            {value === null ? (
              "—"
            ) : (
              <AnimatedNumber value={value} format={unit === "minutes" ? minutes : count} />
            )}
          </strong>
          {delta && (
            <span className={styles.delta} data-tone={delta.tone}>
              {delta.direction !== "flat" && (
                <Icon name={delta.direction === "down" ? "trend-down" : "trend-up"} size={14} />
              )}
              {delta.label}
            </span>
          )}
        </div>
        <small>{note}</small>
      </div>
    </section>
  );
}

export function ReviewKpis({
  pending,
  over24h,
  oldestLabel,
  reviewedToday,
  reviewedYesterday,
  avg7d,
  avgPrev7d,
}: {
  pending: number;
  over24h: number;
  oldestLabel: string | null;
  reviewedToday: number;
  reviewedYesterday: number;
  avg7d: number | null;
  avgPrev7d: number | null;
}) {
  const today = reviewDelta(reviewedToday, reviewedYesterday);
  const speed = reviewDelta(avg7d, avgPrev7d, true);
  return (
    <div className={styles.kpis}>
      <Kpi
        index={0}
        label="Pendentes"
        icon="inbox"
        tone="lilac"
        value={pending}
        note={oldestLabel ? `Mais antiga enviada ${oldestLabel}` : "Nenhuma resposta aguardando"}
      />
      <Kpi
        index={1}
        label="Há mais de 24h"
        icon="clock"
        tone={over24h > 0 ? "yellow" : "green"}
        value={over24h}
        note={over24h > 0 ? "Priorize estas respostas" : "Tudo dentro de um dia"}
      />
      <Kpi
        index={2}
        label="Revisadas hoje"
        icon="check"
        tone="green"
        value={reviewedToday}
        note={`Ontem: ${count(reviewedYesterday)}`}
        delta={
          today && today.direction !== "flat"
            ? { ...today, label: `${today.diff > 0 ? "+" : ""}${today.diff} vs ontem` }
            : null
        }
      />
      <Kpi
        index={3}
        label="Tempo médio de resposta"
        icon="history"
        tone="blue"
        value={avg7d}
        unit="minutes"
        note={
          avgPrev7d === null
            ? "Últimos 7 dias"
            : `Últimos 7 dias · antes: ${formatMinutes(avgPrev7d)}`
        }
        delta={
          speed && speed.direction !== "flat"
            ? { ...speed, label: speed.tone === "positive" ? "Mais rápido" : "Mais lento" }
            : null
        }
      />
    </div>
  );
}
