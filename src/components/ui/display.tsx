import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { clampProgress, cx } from "./utils";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: "default" | "soft" | "accent";
}

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  return (
    <section
      {...props}
      className={cx("yas-card", variant !== "default" && `yas-card--${variant}`, className)}
    >
      {children}
    </section>
  );
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span {...props} className={cx("yas-badge", className)} data-tone={tone} />;
}

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  selected?: boolean;
}

export function Tag({ selected = false, className, ...props }: TagProps) {
  return <span {...props} className={cx("yas-tag", className)} data-selected={selected} />;
}

export interface SelectableTagProps {
  selected?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

export function SelectableTag({
  selected = false,
  disabled,
  children,
  onClick,
}: SelectableTagProps) {
  return (
    <button
      type="button"
      className="yas-tag-button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface AvatarProps {
  image?: ReactNode;
  label: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
}

const avatarSizes = { sm: 32, md: 40, lg: 56 } as const;

export function Avatar({ image, label, fallback, size = "md" }: AvatarProps) {
  const pixels = avatarSizes[size];

  return (
    <span
      className="yas-avatar"
      style={{ width: pixels, height: pixels }}
      role="img"
      aria-label={label}
    >
      {image ?? <span aria-hidden="true">{fallback}</span>}
    </span>
  );
}

export interface ProgressBarProps {
  value: number;
  label?: string;
  showLabel?: boolean;
  showValue?: boolean;
  tone?: "default" | "priority";
}

export function ProgressBar({
  value,
  label,
  showLabel = true,
  showValue = true,
  tone = "default",
}: ProgressBarProps) {
  const safe = clampProgress(value);

  return (
    <div
      className="yas-progress"
      data-tone={tone}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      aria-label={label ?? "Progresso"}
    >
      {((label && showLabel) || showValue) && (
        <div className="yas-progress-header">
          {label && showLabel && <span>{label}</span>}
          {showValue && <strong>{safe}%</strong>}
        </div>
      )}
      <div className="yas-progress-track" aria-hidden="true">
        <div className="yas-progress-value" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  size?: number;
  label?: string;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  size = 88,
  label = "Progresso",
  children,
}: ProgressRingProps) {
  const safe = clampProgress(value);
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  const style = {
    strokeDasharray: circumference,
    strokeDashoffset: offset,
  } satisfies CSSProperties;

  return (
    <div
      className="yas-progress-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="yas-progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="yas-progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={style}
        />
      </svg>
      <span className="yas-progress-ring-content">{children ?? `${safe}%`}</span>
    </div>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: string;
  height?: string;
}

export function Skeleton({ width = "100%", height = "1rem", style, ...props }: SkeletonProps) {
  return (
    <span
      {...props}
      className={cx("yas-skeleton", props.className)}
      aria-hidden="true"
      style={{ width, height, ...style }}
    />
  );
}

export interface DataTableColumn {
  id: string;
  label: string;
  align?: "start" | "end";
}

export interface DataTableRow {
  id: string;
  cells: readonly ReactNode[];
  mobile: ReactNode;
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
}) {
  return (
    <>
      <div className="yas-data-table-frame">
        <table className="yas-data-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" data-align={column.align ?? "start"}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.id ?? index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="yas-responsive-data-list" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id}>{row.mobile}</li>
        ))}
      </ul>
    </>
  );
}

export function ResponsiveDataList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="yas-responsive-data-list yas-responsive-data-list--always" aria-label={label}>
      {children}
    </ul>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="yas-metric-label">{label}</span>
      <strong className="yas-metric-value">{value}</strong>
      {detail && <span className="yas-metric-detail">{detail}</span>}
    </>
  );
  return href ? (
    <a className="yas-metric-card" href={href}>
      {content}
    </a>
  ) : (
    <div className="yas-metric-card">{content}</div>
  );
}

export function KanbanBoard({
  label,
  columns,
}: {
  label: string;
  columns: readonly { id: string; title: string; count: number; children: ReactNode }[];
}) {
  return (
    <div className="yas-kanban-board" aria-label={label}>
      {columns.map((column) => (
        <section
          className="yas-kanban-column"
          key={column.id}
          aria-labelledby={`${column.id}-title`}
        >
          <header className="yas-kanban-heading">
            <h2 id={`${column.id}-title`}>{column.title}</h2>
            <span aria-label={`${column.count} itens`}>{column.count}</span>
          </header>
          <div className="yas-kanban-items">{column.children}</div>
        </section>
      ))}
    </div>
  );
}

export function ScheduleGrid({
  label,
  days,
}: {
  label: string;
  days: readonly { id: string; label: string; content: ReactNode }[];
}) {
  return (
    <div className="yas-schedule-grid" aria-label={label}>
      {days.map((day) => (
        <section className="yas-schedule-day" key={day.id} aria-labelledby={`${day.id}-label`}>
          <h3 id={`${day.id}-label`}>{day.label}</h3>
          <div className="yas-schedule-slots">{day.content}</div>
        </section>
      ))}
    </div>
  );
}
