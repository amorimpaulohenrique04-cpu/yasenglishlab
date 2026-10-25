"use client";

import Link from "next/link";
import { m } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { yasTokens } from "@/styles/tokens";
import { Icon, type IconName } from "./icons";
import { Popover } from "./popover";
import { cx } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  /** Short counter next to the label; exposed to screen readers as the tab's description, so the accessible name stays the label. */
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
  /** Renders every panel and hides the inactive ones, so state inside panels survives tab changes. */
  keepMounted?: boolean;
}

export function Tabs({
  items,
  ariaLabel,
  defaultValue,
  value,
  onValueChange,
  className,
  variant = "pill",
  keepMounted = false,
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
            aria-controls={keepMounted || item.id === activeValue ? `${item.id}-panel` : undefined}
            id={`${item.id}-tab`}
            aria-describedby={item.badge !== undefined ? `${item.id}-tab-count` : undefined}
            tabIndex={item.id === activeValue ? 0 : -1}
            disabled={item.disabled}
            onClick={() => select(item.id)}
          >
            {item.icon && <Icon name={item.icon} size={17} />}
            {item.label}
            {item.badge !== undefined && (
              <>
                <span className="yas-tab-badge" aria-hidden="true">
                  {item.badge}
                </span>
                <span id={`${item.id}-tab-count`} hidden>{`(${item.badge})`}</span>
              </>
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
      {keepMounted
        ? items.map((item) => (
            <div
              key={item.id}
              id={`${item.id}-panel`}
              role="tabpanel"
              className="yas-tab-panel"
              aria-labelledby={`${item.id}-tab`}
              tabIndex={0}
              hidden={item.id !== activeValue}
            >
              {item.content}
            </div>
          ))
        : active && (
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
  /** Custom trigger body (e.g. avatar + name); `label` becomes its accessible name. */
  triggerContent?: ReactNode;
  triggerClassName?: string;
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
  triggerContent,
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

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
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const enabled = itemRefs.current.filter((node, i) => node && !items[i]?.disabled);
      (event.key === "Home" ? enabled[0] : enabled[enabled.length - 1])?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={cx("yas-dropdown", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cx(
          "yas-dropdown-trigger",
          iconOnly && "yas-dropdown-trigger--icon",
          triggerVariant === "primary" && "yas-dropdown-trigger--primary",
          triggerClassName,
        )}
        disabled={disabled}
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={iconOnly || triggerContent ? label : undefined}
      >
        {triggerContent ? (
          triggerContent
        ) : iconOnly ? (
          <Icon name={icon ?? "more"} size={18} />
        ) : (
          <>
            {icon && <Icon name={icon} size={16} />}
            {label}
            <Icon name="down" size={16} className="yas-dropdown-chevron" />
          </>
        )}
      </button>
      <Popover
        id={menuId}
        anchorRef={triggerRef}
        open={open}
        onOpenChange={setOpen}
        placement={align === "end" ? "bottom-end" : "bottom-start"}
        role="menu"
        aria-label={label}
        className="yas-dropdown-menu"
        onOpened={() => itemRefs.current.find(Boolean)?.focus()}
      >
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
                close(true);
                item.onSelect?.();
              }}
            >
              {content}
            </button>
          );
        })}
      </Popover>
    </div>
  );
}
