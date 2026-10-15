import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icons";
import { clampProgress, cx } from "./utils";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: "default" | "soft" | "accent";
  /** Levanta no hover (cards clicáveis). */
  interactive?: boolean;
}

export function Card({
  variant = "default",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={cx(
        "yas-card",
        variant !== "default" && `yas-card--${variant}`,
        interactive && "yas-card--interactive",
        className,
      )}
    >
      {children}
    </section>
  );
}

export type Tint = "lilac" | "blue" | "yellow" | "green" | "pink" | "red";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "muted" | "pink";
  /** Ponto colorido antes do texto (densidade de operação). */
  dot?: boolean;
  icon?: IconName | undefined;
}

export function Badge({ tone = "neutral", dot, icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx("yas-badge", className)}
      data-tone={tone}
      data-dot={dot || undefined}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export interface IconBadgeProps {
  icon: IconName;
  tone?: Tint | "white";
  shape?: "circle" | "square";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Ícone sobre fundo pastel (tiles, listas, KPIs). Sempre decorativo. */
export function IconBadge({
  icon,
  tone = "lilac",
  shape = "circle",
  size = "md",
  className,
}: IconBadgeProps) {
  const pixels = size === "sm" ? 18 : size === "lg" ? 26 : 22;
  return (
    <span
      className={cx("yas-icon-badge", className)}
      data-tone={tone}
      data-shape={shape}
      data-size={size}
      aria-hidden="true"
    >
      <Icon name={icon} size={pixels} />
    </span>
  );
}

export interface HeroProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  kicker?: ReactNode;
  kickerIcon?: IconName;
  title: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  /** Foto decorativa à direita (servida de /public/brand). */
  photo?: string;
  compact?: boolean;
  actions?: ReactNode;
}

/** Faixa roxa com foto recortada: padrão das referências aprovadas. */
export function Hero({
  kicker,
  kickerIcon,
  title,
  titleAs: Title = "h2",
  photo,
  compact,
  actions,
  className,
  children,
  ...props
}: HeroProps) {
  return (
    <section
      {...props}
      className={cx("yas-hero", className)}
      data-photo={photo ? "true" : "false"}
      data-compact={compact || undefined}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- decorative cutout, fixed asset
        <img className="yas-hero-photo" src={photo} alt="" aria-hidden="true" />
      )}
      <div className="yas-hero-copy">
        {kicker && (
          <span className="yas-hero-kicker">
            {kickerIcon && <Icon name={kickerIcon} size={18} />}
            {kicker}
          </span>
        )}
        <Title className="yas-hero-title">{title}</Title>
        {children}
        {actions && <div className="yas-hero-actions">{actions}</div>}
      </div>
    </section>
  );
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
  tone?: "default" | "priority" | "success";
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
  tone?: "default" | "priority";
  stroke?: number;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  size = 88,
  label = "Progresso",
  tone = "default",
  stroke = 8,
  children,
}: ProgressRingProps) {
  const safe = clampProgress(value);
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
      data-tone={tone}
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

export function AvatarStack({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="yas-avatar-stack" role="group" aria-label={label}>
      {children}
    </span>
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
  focusableFrame = false,
}: {
  caption: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  /** Torna a moldura rolável alcançável por teclado quando a tabela não tem conteúdo focável. */
  focusableFrame?: boolean;
}) {
  return (
    <>
      <div
        className={focusableFrame ? "yas-data-table-frame yas-focusable" : "yas-data-table-frame"}
        {...(focusableFrame ? { tabIndex: 0, role: "region", "aria-label": caption } : {})}
      >
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
