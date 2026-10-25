import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Card, Icon, IconBadge, type IconName, type Tint } from "@/components/ui";
import styles from "./teacher-metric.module.css";

/**
 * Teacher-area KPI card (approved reference pattern): separate white card, tinted icon tile on
 * the left, label, large tabular value and a short caption. Built on the Card surface; not a
 * new design-system primitive. Interactive only when `href` or `onClick` is given.
 */
export interface TeacherMetricProps {
  icon: IconName;
  tone?: Tint;
  label: string;
  /** Use a heading level when the label must be exposed as a heading (e.g. Disponibilidade). */
  labelAs?: "span" | "h2" | "h3";
  value?: ReactNode;
  /** `text` renders word values (dates, statuses) at a smaller display size (wraps as fallback). */
  valueKind?: "number" | "text";
  caption?: ReactNode;
  /** Highlights the value with the warning colour. */
  alert?: boolean;
  /** Recolours the value only (e.g. a configured/ok state). */
  valueTone?: "default" | "success";
  href?: string;
  onClick?: () => void;
  /** Filter cards: exposes aria-pressed on the button. */
  pressed?: boolean;
  /** Trailing chevron hint for interactive cards. */
  arrow?: boolean;
  /** Stagger slot for the optional first-paint entrance animation. */
  enterStep?: number;
}

export function TeacherMetric({
  icon,
  tone = "lilac",
  label,
  labelAs: Label = "span",
  value,
  valueKind = "number",
  caption,
  alert = false,
  valueTone = "default",
  href,
  onClick,
  pressed,
  arrow = false,
  enterStep,
}: TeacherMetricProps) {
  const interactive = Boolean(href || onClick);
  const cardClassName = [
    styles.metric,
    interactive && styles.interactive,
    enterStep !== undefined && styles.enter,
  ]
    .filter(Boolean)
    .join(" ");
  // Link/button cannot be <Card>; they reuse the same Card surface class.
  const className = `yas-card ${cardClassName}`;
  const style = enterStep !== undefined ? ({ "--stagger": enterStep } as CSSProperties) : undefined;
  const body = (
    <>
      <IconBadge icon={icon} tone={tone} shape="square" className={styles.tile ?? ""} />
      <span className={styles.body}>
        <Label className={styles.label}>{label}</Label>
        {value !== undefined && (
          <strong
            className={styles.value}
            data-kind={valueKind}
            data-alert={alert || undefined}
            data-tone={valueTone === "success" ? "success" : undefined}
          >
            {value}
          </strong>
        )}
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
      {arrow && interactive && <Icon name="right" size={16} className={styles.arrow} />}
    </>
  );
  if (href)
    return (
      <Link className={className} style={style} href={href} scroll={false}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={onClick}
        aria-pressed={pressed}
      >
        {body}
      </button>
    );
  return (
    <Card className={cardClassName} style={style}>
      {body}
    </Card>
  );
}

/** Responsive 4-up grid (2-up on narrow containers) for TeacherMetric cards. */
export function TeacherMetricGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.grid} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
