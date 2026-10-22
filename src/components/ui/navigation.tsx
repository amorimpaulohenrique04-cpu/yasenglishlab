"use client";

import Link from "next/link";
import { m } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { yasTokens } from "@/styles/tokens";
import { Icon, type IconName } from "./icons";
import { cx } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  /** Short decorative counter next to the label; the label stays the accessible name. */
  badge?: ReactNode;
  icon?: IconName;
}

export interface TabsProps {
  items: readonly TabItem[];
  ariaLabel: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** `pill` (default) or `underline`, with an indicator that slides between tabs. */
  variant?: "pill" | "underline";
}

export function Tabs({
  items,
  ariaLabel,
  defaultValue,
  value,
  onValueChange,
  className,
  variant = "pill",
}: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabled);
  const activeValue = value ?? internalValue;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const indicatorId = useId();

  const select = (id: string) => {
    if (value === undefined) setInternalValue(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled);
    const current = enabled.findIndex(({ item }) => item.id === activeValue);
    if (current < 0) return;

    let target = current;
    if (event.key === "ArrowRight") target = (current + 1) % enabled.length;
    else if (event.key === "ArrowLeft") target = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = enabled.length - 1;
    else return;

    event.preventDefault();
    const next = enabled[target];
    if (!next) return;
    select(next.item.id);
    buttonRefs.current[next.index]?.focus();
  };

  const active = items.find((item) => item.id === activeValue);

  return (
    <div className={cx("yas-tabs", variant === "underline" && "yas-tabs--underline", className)}>
      <div className="yas-tab-list" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            className="yas-tab"
            aria-selected={item.id === activeValue}
            aria-controls={`${item.id}-panel`}
            id={`${item.id}-tab`}
            tabIndex={item.id === activeValue ? 0 : -1}
            disabled={item.disabled}
            onClick={() => select(item.id)}
          >
            {item.icon && <Icon name={item.icon} size={17} />}
            {item.label}
            {item.badge !== undefined && (
              <span className="yas-tab-badge" aria-hidden="true">
                {item.badge}
              </span>
            )}
            {variant === "underline" && item.id === activeValue && (
              <m.span
                className="yas-tab-indicator"
                layoutId={`tab-indicator-${indicatorId}`}
                transition={yasTokens.motion.springs.snappy}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
      {active && (
        <div
          key={active.id}
          id={`${active.id}-panel`}
          role="tabpanel"
          className="yas-tab-panel"
          aria-labelledby={`${active.id}-tab`}
          tabIndex={0}
        >
          {active.content}
        </div>
      )}
    </div>
  );
}

export interface SegmentedNavItem {
  id: string;
  label: string;
  href: string;
  icon?: IconName;
}

/**
 * View switcher made of links (each option is its own URL), unlike `Tabs`, which swaps
 * panels in place. The active pill slides between options.
 */
export function SegmentedNav({
  items,
  value,
  ariaLabel,
  className,
}: {
  items: readonly SegmentedNavItem[];
  value: string;
  ariaLabel: string;
  className?: string;
}) {
  const indicatorId = useId();
  return (
    <nav className={cx("yas-segmented", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const current = item.id === value;
        return (
          <Link
            key={item.id}
            href={item.href}
            className="yas-segmented-item"
            aria-current={current ? "page" : undefined}
            scroll={false}
          >
            {current && (
              <m.span
                className="yas-segmented-pill"
                layoutId={`segmented-${indicatorId}`}
                transition={yasTokens.motion.springs.snappy}
                aria-hidden="true"
              />
            )}
            {item.icon && <Icon name={item.icon} size={16} />}
            <span className="yas-segmented-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  homeHref,
  homeLabel = "Início",
}: {
  items: readonly BreadcrumbItem[];
  homeHref: string;
  homeLabel?: string;
}) {
  return (
    <nav className="yas-breadcrumbs" aria-label="Trilha de navegação">
      <ol>
        <li>
          <Link href={homeHref} aria-label={homeLabel}>
            <Icon name="home" size={17} />
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span className="yas-breadcrumbs-sep" aria-hidden="true">
              /
            </span>
            {item.href && index < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={index === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface DropdownItem {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
  /** Renders the item as a navigation link. */
  href?: string;
  icon?: IconName;
}

export interface DropdownProps {
  label: string;
  items: readonly DropdownItem[];
  /** Shows only the icon; `label` remains the accessible name. */
  iconOnly?: boolean;
  icon?: IconName;
  align?: "start" | "end";
  /** "primary" renders the trigger as the violet main action. */
  triggerVariant?: "default" | "primary";
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  label,
  items,
  iconOnly = false,
  icon,
  align = "end",
  triggerVariant = "default",
  disabled = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const moveFocus = (index: number, direction: 1 | -1) => {
    const enabledIndexes = items.map((item, i) => (!item.disabled ? i : -1)).filter((i) => i >= 0);
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(index);
    const nextPosition =
      currentPosition < 0
        ? 0
        : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    const nextIndex = enabledIndexes[nextPosition];
    if (nextIndex === undefined) return;
    itemRefs.current[nextIndex]?.focus();
  };

  const onItemKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={cx("yas-dropdown", className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cx(
          "yas-dropdown-trigger",
          iconOnly && "yas-dropdown-trigger--icon",
          triggerVariant === "primary" && "yas-dropdown-trigger--primary",
        )}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={iconOnly ? label : undefined}
        onClick={() => {
          setOpen((current) => !current);
          queueMicrotask(() => itemRefs.current.find(Boolean)?.focus());
        }}
      >
        {iconOnly ? (
          <Icon name={icon ?? "more"} size={18} />
        ) : (
          <>
            {icon && <Icon name={icon} size={16} />}
            {label}
            <Icon name="down" size={16} />
          </>
        )}
      </button>
      {open && (
        <div className="yas-dropdown-menu" data-align={align} role="menu" aria-label={label}>
          {items.map((item, index) => {
            const content = (
              <>
                {item.icon && <Icon name={item.icon} size={16} />}
                <span>{item.label}</span>
              </>
            );
            const setRef = (node: HTMLElement | null) => {
              itemRefs.current[index] = node;
            };
            return item.href && !item.disabled ? (
              <Link
                key={item.id}
                ref={setRef}
                href={item.href}
                role="menuitem"
                className="yas-dropdown-item"
                data-destructive={item.destructive || undefined}
                onKeyDown={(event) => onItemKeyDown(event, index)}
                onClick={() => close(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.id}
                ref={setRef}
                type="button"
                role="menuitem"
                className="yas-dropdown-item"
                data-destructive={item.destructive || undefined}
                disabled={item.disabled}
                onKeyDown={(event) => onItemKeyDown(event, index)}
                onClick={() => {
                  item.onSelect?.();
                  close(false);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
