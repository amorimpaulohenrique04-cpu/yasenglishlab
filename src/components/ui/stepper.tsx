"use client";

import type { CSSProperties } from "react";

import { Icon } from "./icons";
import { cx } from "./utils";

export interface StepperStep {
  label: string;
  description?: string;
}

/**
 * Ordered progress through a multi-step task. Completed steps can be revisited through
 * `onStepSelect`; future steps stay inert so validation happens in order.
 */
export function Stepper({
  steps,
  current,
  ariaLabel,
  onStepSelect,
  orientation = "vertical",
  className,
}: {
  steps: readonly StepperStep[];
  current: number;
  ariaLabel: string;
  onStepSelect?: (index: number) => void;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <ol
      className={cx("yas-stepper", className)}
      data-orientation={orientation}
      aria-label={ariaLabel}
      style={
        {
          "--yas-stepper-progress": steps.length > 1 ? current / (steps.length - 1) : 0,
        } as CSSProperties
      }
    >
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        const marker = (
          <>
            <span className="yas-stepper-marker" aria-hidden="true">
              {state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="yas-stepper-text">
              <strong>{step.label}</strong>
              {step.description && <small>{step.description}</small>}
            </span>
          </>
        );
        return (
          <li
            key={step.label}
            className="yas-stepper-step"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            {state === "done" && onStepSelect ? (
              <button
                type="button"
                className="yas-stepper-button"
                onClick={() => onStepSelect(index)}
                aria-label={`Voltar para a etapa ${index + 1}: ${step.label}`}
              >
                {marker}
              </button>
            ) : (
              <div className="yas-stepper-button">{marker}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
