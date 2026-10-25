"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Icon, type IconName } from "./icons";

export interface CommandItem {
  id: string;
  group: string;
  label: string;
  description?: string;
  icon?: IconName;
  /** Extra text matched by the search (not displayed). */
  keywords?: string;
  href?: string;
  onSelect?: () => void;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

/**
 * Keyboard-first search over pages and records (Ctrl/⌘ K). Built on the native modal dialog,
 * with an ARIA combobox + listbox inside.
 */
export function CommandPalette({
  items,
  placeholder = "Buscar…",
  label = "Busca rápida",
  open,
  onOpenChange,
  empty = "Nada encontrado.",
  shortcut = true,
}: {
  items: readonly CommandItem[];
  placeholder?: string;
  label?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empty?: ReactNode;
  /** Registers the global Ctrl/⌘ K shortcut. */
  shortcut?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matched = terms.length
      ? items.filter((item) => {
          const haystack = normalize(
            `${item.label} ${item.description ?? ""} ${item.keywords ?? ""} ${item.group}`,
          );
          return terms.every((term) => haystack.includes(term));
        })
      : items;
    return matched.slice(0, 40);
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, { item: CommandItem; index: number }[]>();
    results.forEach((item, index) => {
      map.set(item.group, [...(map.get(item.group) ?? []), { item, index }]);
    });
    return [...map.entries()];
  }, [results]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
  };

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    close();
    if (item.onSelect) item.onSelect();
    else if (item.href) router.push(item.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  return (
    <dialog
      ref={dialogRef}
      className="yas-command"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      <div className="yas-command-search">
        <Icon name="search" size={20} />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd aria-hidden="true">Esc</kbd>
      </div>
      <div className="yas-command-list" id={listId} role="listbox" aria-label="Resultados">
        {results.length === 0 ? (
          <p className="yas-command-empty" role="status">
            {empty}
          </p>
        ) : (
          groups.map(([group, entries]) => (
            <div key={group} role="group" aria-label={group} className="yas-command-group">
              <p className="yas-command-group-label" aria-hidden="true">
                {group}
              </p>
              {entries.map(({ item, index }) => (
                <div
                  key={item.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className="yas-command-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(item)}
                >
                  <span className="yas-command-icon" aria-hidden="true">
                    <Icon name={item.icon ?? "right"} size={17} />
                  </span>
                  <span className="yas-command-text">
                    <strong>{item.label}</strong>
                    {item.description && <small>{item.description}</small>}
                  </span>
                  <Icon name="right" size={16} className="yas-command-go" />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <p className="yas-command-hint" aria-hidden="true">
        <kbd>↑</kbd>
        <kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir
      </p>
    </dialog>
  );
}
