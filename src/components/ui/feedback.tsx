import type { ReactNode } from "react";

import { Button, type ButtonProps } from "./controls";

type FeedbackTone = "neutral" | "success" | "warning" | "error" | "info";

const symbols: Record<FeedbackTone, string> = {
  neutral: "•",
  success: "✓",
  warning: "!",
  error: "!",
  info: "i",
};

export interface AlertProps {
  tone?: FeedbackTone;
  title: string;
  description?: string;
}

export function Alert({ tone = "neutral", title, description }: AlertProps) {
  return (
    <div className="yas-alert" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <strong aria-hidden="true">{symbols[tone]}</strong>
      <div>
        <div className="yas-alert-title">{title}</div>
        {description && <div className="yas-alert-description">{description}</div>}
      </div>
    </div>
  );
}

export interface ToastProps {
  tone?: FeedbackTone;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function Toast({ tone = "neutral", title, description, action }: ToastProps) {
  return (
    <div className="yas-toast" role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <strong aria-hidden="true">{symbols[tone]}</strong>
      <div>
        <div className="yas-alert-title">{title}</div>
        {description && <div className="yas-alert-description">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export interface StateProps {
  title: string;
  description: string;
  action?: Omit<ButtonProps, "children"> & { label: string };
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="yas-state">
      <div className="yas-state-icon" aria-hidden="true">
        +
      </div>
      <h3 className="yas-state-title">{title}</h3>
      <p className="yas-state-description">{description}</p>
      {action && <Button {...action}>{action.label}</Button>}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div className="yas-state" data-tone="error" role="alert">
      <div className="yas-state-icon" aria-hidden="true">
        !
      </div>
      <h3 className="yas-state-title">{title}</h3>
      <p className="yas-state-description">{description}</p>
      {action && <Button {...action}>{action.label}</Button>}
    </div>
  );
}
