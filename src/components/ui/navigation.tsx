"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: readonly TabItem[];
  ariaLabel: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ items, ariaLabel, defaultValue, value, onValueChange, className }: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabled);
  const activeValue = value ?? internalValue;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
    select(next.item.id);
    buttonRefs.current[next.index]?.focus();
  };

  const active = items.find((item) => item.id === activeValue);

  return (
    <div className={cx("yas-tabs", className)}>
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
            {item.label}
          </button>
        ))}
      </div>
      {active && (
        <div id={`${active.id}-panel`} role="tabpanel" aria-labelledby={`${active.id}-tab`} tabIndex={0}>
          {active.content}
        </div>
      )}
    </div>
  );
}

export interface DropdownItem {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
}

export interface DropdownProps {
  label: string;
  items: readonly DropdownItem[];
}

export function Dropdown({ label, items }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  const moveFocus = (index: number, direction: 1 | -1) => {
    const enabledIndexes = items.map((item, i) => (!item.disabled ? i : -1)).filter((i) => i >= 0);
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(index);
    const nextPosition = currentPosition < 0 ? 0 : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    itemRefs.current[enabledIndexes[nextPosition]]?.focus();
  };

  return (
    <div className="yas-dropdown" ref={rootRef}>
      <button
        type="button"
        className="yas-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          queueMicrotask(() => itemRefs.current.find(Boolean)?.focus());
        }}
      >
        {label}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="yas-dropdown-menu" role="menu" aria-label={label}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className="yas-dropdown-item"
              data-destructive={item.destructive || undefined}
              disabled={item.disabled}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(index, -1);
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
