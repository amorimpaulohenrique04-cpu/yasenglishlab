"use client";

import { useId } from "react";
import { RUBRIC_LABELS, RUBRIC_LEVELS } from "@/modules/practice/domain/rubric";
import styles from "./reviews.module.css";

type Level = (typeof RUBRIC_LEVELS)[number];

/**
 * One rubric dimension as a 4-segment radio group (native radios: arrow keys move between
 * levels and `required` blocks an incomplete submit). Categorical only, never a score.
 */
export function RubricScale({
  dimension,
  value,
  onChange,
  readOnly = false,
}: {
  dimension: string;
  value: string | undefined;
  onChange?: (level: Level) => void;
  readOnly?: boolean;
}) {
  const id = useId();
  const index = RUBRIC_LEVELS.indexOf(value as Level);
  return (
    <div
      className={styles.scale}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-readonly={readOnly || undefined}
      data-level={index >= 0 ? index : undefined}
    >
      <div className={styles.scaleHead}>
        <span id={`${id}-label`} className={styles.scaleLabel}>
          {RUBRIC_LABELS[dimension]}
        </span>
        <span className={styles.scaleValue} aria-hidden="true">
          {index >= 0 ? `Nível ${index + 1} de 4` : "Selecione um nível"}
        </span>
      </div>
      <div className={styles.segments}>
        {RUBRIC_LEVELS.map((level, i) => {
          const checked = value === level;
          return (
            <label
              key={level}
              className={styles.segment}
              data-level={i}
              data-checked={checked || undefined}
              data-filled={(index >= 0 && i <= index) || undefined}
            >
              <input
                type="radio"
                name={readOnly ? undefined : dimension}
                value={level}
                checked={checked}
                required={!readOnly}
                disabled={readOnly && !checked}
                readOnly={readOnly}
                onChange={() => onChange?.(level)}
              />
              <span className={styles.segmentBar} aria-hidden="true" />
              <span className={styles.segmentText}>{RUBRIC_LABELS[level]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
