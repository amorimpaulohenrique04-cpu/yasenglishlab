"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

export interface AnimatedNumberProps {
  value: number;
  /** Formats every frame and the server render, e.g. `(n) => `${n.toFixed(1)}h``. */
  format?: (value: number) => string;
  duration?: number;
}

const integer = (value: number) => Math.round(value).toLocaleString("pt-BR");

/**
 * Counts up to `value` on mount and between later values. The server render already holds the
 * final text, so the number is correct without JavaScript and for assistive technology.
 */
export function AnimatedNumber({ value, format = integer, duration = 0.6 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0, 0, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, format, duration, reduced]);

  return (
    <span ref={ref} className="yas-tabular">
      {format(value)}
    </span>
  );
}
