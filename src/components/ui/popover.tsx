"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { cx } from "./utils";

export interface PopoverProps {
  /** Referenced by the trigger's `popoverTarget`. */
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: "bottom-start" | "bottom-end";
  role?: string;
  "aria-label"?: string;
  className?: string;
  /** Runs after the surface is placed, e.g. to move focus inside. */
  onOpened?: (surface: HTMLDivElement) => void;
  children: ReactNode;
}

const GAP = 6;
const EDGE = 8;

/**
 * Anchored, non-modal surface on the native Popover API: it lives in the top layer (never clipped
 * by `overflow` or stacking contexts), light-dismisses, closes on Escape and returns focus to the
 * trigger. The trigger opens it with `popoverTarget={id}`; content mounts only while open.
 */
export function Popover({
  id,
  anchorRef,
  open,
  onOpenChange,
  placement = "bottom-start",
  role,
  "aria-label": ariaLabel,
  className,
  onOpened,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const opened = useRef(onOpened);
  useEffect(() => {
    opened.current = onOpened;
  }, [onOpened]);

  const place = useCallback(() => {
    const anchor = anchorRef.current,
      surface = ref.current;
    if (!anchor || !surface) return;
    const rect = anchor.getBoundingClientRect();
    const width = surface.offsetWidth,
      height = surface.offsetHeight;
    let top = rect.bottom + GAP;
    const above = rect.top - GAP - height;
    if (top + height > window.innerHeight - EDGE && above > EDGE) top = above;
    const preferred = placement === "bottom-end" ? rect.right - width : rect.left;
    const left = Math.max(EDGE, Math.min(preferred, window.innerWidth - width - EDGE));
    surface.style.top = `${Math.max(EDGE, top)}px`;
    surface.style.left = `${left}px`;
    surface.dataset.side = top < rect.top ? "top" : "bottom";
    surface.dataset.align = placement === "bottom-end" ? "end" : "start";
    surface.dataset.placed = "";
  }, [anchorRef, placement]);

  // Keeps the native state in line with programmatic changes (e.g. closing after a choice).
  useEffect(() => {
    const surface = ref.current;
    if (!surface || typeof surface.showPopover !== "function") return;
    const isOpen = surface.matches(":popover-open");
    if (open && !isOpen) surface.showPopover();
    if (!open && isOpen) surface.hidePopover();
  }, [open]);

  useLayoutEffect(() => {
    const surface = ref.current;
    if (!open || !surface) {
      if (surface) delete surface.dataset.placed;
      return;
    }
    place();
    opened.current?.(surface);
    const reposition = () => place();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      role={role}
      aria-label={ariaLabel}
      className={cx("yas-popover", className)}
      onToggle={(event) => onOpenChange(event.newState === "open")}
    >
      {open ? children : null}
    </div>
  );
}
