import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(
        "yas-button",
        `yas-button--${variant}`,
        size !== "md" && `yas-button--${size}`,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="yas-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  label: string;
}

export function IconButton({
  label,
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button {...props} type={type} aria-label={label} className={cx("yas-icon-button", className)}>
      {children}
    </button>
  );
}

type FieldTone = "default" | "error" | "success";

interface FieldFrameProps {
  id?: string | undefined;
  label: string;
  required?: boolean | undefined;
  tone?: FieldTone | undefined;
  message?: string | undefined;
  children: (id: string, describedBy?: string) => ReactNode;
}

function FieldFrame({ id, label, required, tone = "default", message, children }: FieldFrameProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const messageId = message ? `${controlId}-message` : undefined;

  return (
    <div className="yas-field" data-tone={tone}>
      <label className="yas-field-label" htmlFor={controlId}>
        {label}
        {required ? " *" : ""}
      </label>
      {children(controlId, messageId)}
      <span
        className="yas-field-message"
        id={messageId}
        aria-live={tone === "error" ? "polite" : undefined}
      >
        {message ?? ""}
      </span>
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  tone?: FieldTone;
  message?: string;
}

export function Input({
  id,
  label,
  tone = "default",
  message,
  required,
  className,
  ...props
}: InputProps) {
  return (
    <FieldFrame id={id} label={label} tone={tone} message={message} required={required}>
      {(controlId, describedBy) => (
        <input
          {...props}
          id={controlId}
          className={cx("yas-field-control", className)}
          required={required}
          aria-invalid={tone === "error" || undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldFrame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  tone?: FieldTone;
  message?: string;
}

export function Select({
  id,
  label,
  options,
  tone = "default",
  message,
  required,
  className,
  ...props
}: SelectProps) {
  return (
    <FieldFrame id={id} label={label} tone={tone} message={message} required={required}>
      {(controlId, describedBy) => (
        <select
          {...props}
          id={controlId}
          className={cx("yas-field-control", className)}
          required={required}
          aria-invalid={tone === "error" || undefined}
          aria-describedby={describedBy}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  tone?: FieldTone;
  message?: string;
}

export function Textarea({
  id,
  label,
  tone = "default",
  message,
  required,
  className,
  ...props
}: TextareaProps) {
  return (
    <FieldFrame id={id} label={label} tone={tone} message={message} required={required}>
      {(controlId, describedBy) => (
        <textarea
          {...props}
          id={controlId}
          className={cx("yas-field-control", className)}
          required={required}
          aria-invalid={tone === "error" || undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldFrame>
  );
}

export interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className, ...props }: ChoiceProps) {
  return (
    <label className={cx("yas-check", className)}>
      <input {...props} type="checkbox" className="yas-check-control" />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, className, ...props }: ChoiceProps) {
  return (
    <label className={cx("yas-check", className)}>
      <input {...props} type="radio" className="yas-check-control" />
      <span>{label}</span>
    </label>
  );
}
