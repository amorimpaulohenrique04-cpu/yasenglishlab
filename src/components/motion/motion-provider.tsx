"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

/**
 * Scopes `motion/react` to an area of the app. `LazyMotion strict` keeps the bundle on the
 * small `m.*` components, and `reducedMotion="user"` turns transform/layout animations into
 * instant changes when the OS asks for reduced motion (CSS tokens already do the same).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
