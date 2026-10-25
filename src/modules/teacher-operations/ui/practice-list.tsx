"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge, Button, Dropdown, Icon, type DropdownItem } from "@/components/ui";
import type { PracticeLibraryItem as TeacherPracticeListItem } from "../domain/practice-library";
import { yasTokens } from "@/styles/tokens";
import { SKILL_LABELS } from "./practice-builder-logic";
import styles from "./practice-list.module.css";

type StatusFilter = "all" | "draft" | "published";
type DuplicateAction = (formData: FormData) => void | Promise<void>;

const tabs: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "draft", label: "Rascunhos" },
  { id: "published", label: "Publicadas" },
];

const skillIcons = {
  SPEAKING: "chat",
  LISTENING: "headphones",
  PRONUNCIATION: "mic",
  VOCABULARY: "book",
  GRAMMAR: "pen",
  WRITING: "pen",
} as const;

function statusHref(status: StatusFilter, search: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search.trim()) params.set("q", search.trim());
  const query = params.toString();
  return query ? `/teacher/praticas?${query}` : "/teacher/praticas";
}

function editedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const today = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const editedDay = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (editedDay === today) return `Editada hoje, ${formatted}`;
  return `Editada em ${new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")}`;
}

function lessonLabel(item: TeacherPracticeListItem) {
  if (item.lessonTitle) return item.lessonTitle;
  if (item.moduleTitle) return item.moduleTitle;
  return "Aula não vinculada";
}

export function PracticeList({
  items,
  status,
  search,
  duplicateAction,
}: {
  items: readonly TeacherPracticeListItem[];
  status: string;
  search: string;
  duplicateAction: DuplicateAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentStatus: StatusFilter = status === "draft" || status === "published" ? status : "all";
  const [query, setQuery] = useState(search);
  const [previousSearch, setPreviousSearch] = useState(search);
  const [pending, startTransition] = useTransition();

  if (search !== previousSearch) {
    setPreviousSearch(search);
    setQuery(search);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = statusHref(currentStatus, query);
      if (`${pathname}${window.location.search}` !== next) {
        startTransition(() => router.replace(next, { scroll: false }));
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [currentStatus, pathname, query, router]);

  const counts = useMemo(
    () => ({
      all: items.length,
      draft: items.filter((item) => item.publicationStatus === "DRAFT").length,
      published: items.filter((item) => item.publicationStatus === "PUBLISHED").length,
    }),
    [items],
  );
  const menuItems = (item: TeacherPracticeListItem, href: string): DropdownItem[] => {
    const viewOnly = item.publicationStatus === "PUBLISHED" || item.hasAttempts;
    return [
      {
        id: "open",
        label: viewOnly ? "Visualizar" : "Editar",
        href,
        icon: viewOnly ? "eye" : "pen",
      },
      {
        id: "duplicate",
        label: "Duplicar",
        icon: "file",
        onSelect: () => {
          const form = new FormData();
          form.set("id", item.id);
          startTransition(async () => {
            await duplicateAction(form);
          });
        },
      },
    ];
  };
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = items.filter((item) => {
    if (currentStatus === "draft" && item.publicationStatus !== "DRAFT") return false;
    if (currentStatus === "published" && item.publicationStatus !== "PUBLISHED") return false;
    if (!normalized) return true;
    return [item.title, item.courseTitle, item.objective, item.moduleTitle, item.lessonTitle]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalized));
  });

  return (
    <section
      className={styles.library}
      aria-label="Biblioteca de práticas"
      data-pending={pending || undefined}
    >
      <label className={styles.search}>
        <Icon name="search" size={18} />
        <span className="sr-only">Buscar prática por título, curso ou aula</span>
        <input
          type="search"
          value={query}
          maxLength={200}
          placeholder="Buscar prática por título, curso ou aula..."
          onChange={(event) => setQuery(event.target.value)}
        />
        <Icon name="search" size={17} />
      </label>

      <nav className={styles.tabs} aria-label="Filtrar práticas por situação">
        {tabs.map((tab) => {
          const selected = currentStatus === tab.id;
          return (
            <Link
              key={tab.id}
              className={styles.tab}
              href={statusHref(tab.id, query)}
              aria-current={selected ? "page" : undefined}
              scroll={false}
            >
              {selected && (
                <m.span
                  layoutId="practice-tab"
                  className={styles.tabIndicator}
                  transition={yasTokens.motion.springs.snappy}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              <span className={styles.tabCount}>{counts[tab.id]}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <div className={styles.noResults} role="status">
          <span className={styles.noResultsIcon} aria-hidden="true">
            <Icon name="search" size={22} />
          </span>
          <h2>{normalized ? "Nenhuma prática encontrada" : "Nenhuma prática nesta situação"}</h2>
          <p>
            {normalized
              ? "Tente buscar por outro título, curso ou aula."
              : "As práticas aparecerão aqui quando você criar uma nova."}
          </p>
          {(normalized || currentStatus !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                router.replace("/teacher/praticas", { scroll: false });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <m.ul className={styles.list} layout>
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((item, index) => {
              const published = item.publicationStatus === "PUBLISHED";
              const href = `/teacher/praticas/${item.id}`;
              const icon = skillIcons[item.skill];
              return (
                <m.li
                  key={item.id}
                  className={styles.card}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{
                    ...yasTokens.motion.springs.gentle,
                    delay: Math.min(index * 0.035, 0.18),
                  }}
                >
                  <span className={styles.skillArt} data-skill={item.skill} aria-hidden="true">
                    <Icon name={icon} size={23} />
                  </span>
                  <div className={styles.cardMain}>
                    <div className={styles.titleLine}>
                      <Link className={styles.title} href={href}>
                        {item.title}
                      </Link>
                      <Badge tone="info">{SKILL_LABELS[item.skill]}</Badge>
                      {(item.difficulty || item.cefrTarget) && (
                        <Badge tone="muted">{item.difficulty || item.cefrTarget}</Badge>
                      )}
                    </div>
                    <p className={styles.objective}>
                      {item.objective || "Sem objetivo informado."}
                    </p>
                    <div className={styles.metadata}>
                      <span>
                        <Icon name="file" size={14} />
                        {item.itemCount} {item.itemCount === 1 ? "questão" : "questões"}
                      </span>
                      <span>
                        <Icon name="clock" size={14} />
                        {item.estimatedMinutes} min
                      </span>
                      <span className={styles.lesson} title={lessonLabel(item)}>
                        <Icon name="book" size={14} />
                        {lessonLabel(item)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.statusCol}>
                    <Badge tone={published ? "success" : "neutral"} dot>
                      {published ? "Publicada" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className={styles.cardAside}>
                    <span className={styles.edited}>{editedLabel(item.updatedAt)}</span>
                    {!published && !item.hasAttempts && (
                      <Link className="yas-button yas-button--outline yas-button--sm" href={href}>
                        Continuar
                      </Link>
                    )}
                  </div>
                  <div className={styles.menu}>
                    <Dropdown
                      iconOnly
                      label={`Ações de ${item.title}`}
                      items={menuItems(item, href)}
                    />
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </m.ul>
      )}
    </section>
  );
}
