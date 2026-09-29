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
  showValue?: boolean;
  tone?: "default" | "priority";
}

export function ProgressBar({
  value,
  label,
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
      {(label || showValue) && (
        <div className="yas-progress-header">
          <span>{label}</span>
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
