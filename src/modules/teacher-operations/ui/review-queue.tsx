"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/ui";
import { RUBRIC_LABELS, rubricDimensionsFor } from "@/modules/practice/domain/rubric";
import { AudioPlayer } from "@/modules/practice/ui/audio-player";
import { yasTokens } from "@/styles/tokens";
import {
  REVIEW_KIND_LABELS,
  formatWaiting,
  queueUrl,
  waitingTone,
  type QueueFilters,
  type QueueTab,
  type ReviewQueueEntry,
} from "../domain/review-queue";
import { initials } from "../domain/session-calendar";
import styles from "./reviews.module.css";
import sessionStyles from "./sessions.module.css";

const TAB_LABELS: Record<QueueTab, string> = {
  all: "Todas",
  speaking: REVIEW_KIND_LABELS.speaking,
  pronunciation: REVIEW_KIND_LABELS.pronunciation,
  writing: REVIEW_KIND_LABELS.writing,
  over24h: "Mais de 24h",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatSubmitted(iso: string) {
  return dateTime.format(new Date(iso)).replace(".", "");
}

function tone(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return sum % 4;
}

export function StudentAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span className={styles.avatar} data-tone={tone(name)} data-size={size} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function KindChip({ kind }: { kind: ReviewQueueEntry["kind"] }) {
  return (
    <span className={styles.kind} data-kind={kind}>
      <Icon
        name={kind === "writing" ? "pen" : kind === "pronunciation" ? "mic" : "chat"}
        size={14}
      />
      {REVIEW_KIND_LABELS[kind]}
    </span>
  );
}

export function WaitingChip({ submittedAt, now }: { submittedAt: string; now: number }) {
  return (
    <span className={styles.waiting} data-tone={waitingTone(submittedAt, now)}>
      <Icon name="clock" size={13} />
      {formatWaiting(submittedAt, now)}
    </span>
  );
}

/** Below this width the preview is not shown and rows lead straight to the review page. */
const PREVIEW_MIN_PX = 1040;

function useWide<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWide((entry?.contentRect.width ?? 0) >= PREVIEW_MIN_PX),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, wide] as const;
}

/** All kinds of an attempt: a written + spoken practice shows both chips. */
function KindChips({ entry }: { entry: ReviewQueueEntry }) {
  return (
    <span className={styles.kindList}>
      {entry.kinds.map((kind) => (
        <KindChip key={kind} kind={kind} />
      ))}
    </span>
  );
}

export function ReviewQueue({
  entries,
  total,
  filteredTotal,
  counts,
  filters,
  cohorts,
  now,
  nextHref,
  firstHref,
  audioAction,
}: {
  /** One page of attempts, already filtered and ordered by the database. */
  entries: readonly ReviewQueueEntry[];
  total: number;
  filteredTotal: number;
  /** Whole-scope counts; a mixed attempt counts in each of its tabs. */
  counts: Record<QueueTab, number>;
  filters: QueueFilters;
  cohorts: readonly string[];
  now: number;
  nextHref: string | null;
  firstHref: string | null;
  audioAction: (id: string) => Promise<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const debounce = useRef<number>(undefined);
  const [layoutRef, wide] = useWide<HTMLDivElement>();
  const listRef = useRef<HTMLTableSectionElement>(null);
  const initial = entries.some((e) => e.id === filters.item) ? filters.item : entries[0]?.id;
  const [selectedId, setSelectedId] = useState(initial);
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  const go = (patch: Partial<QueueFilters>) =>
    startTransition(() =>
      router.replace(queueUrl(filters, { ...patch, item: "", after: "" }), { scroll: false }),
    );

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    window.history.replaceState(null, "", queueUrl(filters, { item: id }));
    if (focus) {
      listRef.current
        ?.querySelector<HTMLAnchorElement>(`tr[data-id="${id}"] a`)
        ?.focus({ preventScroll: false });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const index = entries.findIndex((entry) => entry.id === selected?.id);
    const next = entries[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    select(next.id, true);
  };

  const filtered = filters.tab !== "all" || filters.q || filters.cohort;
  const nextOfSelected = selected ? entries[entries.indexOf(selected) + 1] : undefined;

  return (
    <section className={styles.queueCard} aria-labelledby="review-queue-title">
      <header className={styles.queueHeader}>
        <h2 id="review-queue-title">
          Fila de revisões <span className={styles.countPill}>{total}</span>
        </h2>
        <nav className={styles.tabs} aria-label="Filtrar por tipo de resposta">
          {(Object.keys(TAB_LABELS) as QueueTab[]).map((tab) => {
            const current = filters.tab === tab;
            return (
              <Link
                key={tab}
                href={queueUrl(filters, { tab, item: "", after: "" })}
                className={styles.tab}
                aria-current={current ? "page" : undefined}
                scroll={false}
              >
                {current && (
                  <m.span
                    layoutId="review-tab"
                    className={styles.tabPill}
                    transition={yasTokens.motion.springs.snappy}
                    aria-hidden="true"
                  />
                )}
                <span className={styles.tabLabel}>{TAB_LABELS[tab]}</span>
                <span className={styles.tabCount}>{counts[tab]}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className={styles.toolbar} data-pending={pending || undefined}>
        <label className={sessionStyles.search}>
          <Icon name="search" size={17} />
          <span className="sr-only">Buscar aluno ou atividade</span>
          <input
            type="search"
            value={query}
            maxLength={200}
            placeholder="Buscar aluno ou atividade"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              window.clearTimeout(debounce.current);
              debounce.current = window.setTimeout(() => go({ q: value.trim() }), 300);
            }}
          />
        </label>
        <label className={sessionStyles.selectChip}>
          <select
            aria-label="Turma"
            value={filters.cohort}
            onChange={(event) => go({ cohort: event.target.value })}
          >
            <option value="">Todas as turmas</option>
            {cohorts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </label>
        <label className={sessionStyles.selectChip}>
          <select
            aria-label="Ordem"
            value={filters.order}
            onChange={(event) => go({ order: event.target.value as QueueFilters["order"] })}
          >
            <option value="oldest">Mais antigas primeiro</option>
            <option value="newest">Mais recentes primeiro</option>
          </select>
          <Icon name="down" size={16} />
        </label>
        {filtered && (
          <Link
            className="yas-button yas-button--ghost yas-button--sm"
            href={queueUrl({
              tab: "all",
              q: "",
              cohort: "",
              order: filters.order,
              item: "",
              after: "",
            })}
            onClick={() => setQuery("")}
            scroll={false}
          >
            Limpar filtros
          </Link>
        )}
        <span className={styles.toolbarProgress} aria-hidden="true" />
      </div>

      <div ref={layoutRef} className={styles.queueLayout} data-wide={wide || undefined}>
        {entries.length === 0 ? (
          <div className={styles.queueEmpty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <Icon name="funnel" size={26} />
            </span>
            <h3>Nenhuma resposta com estes filtros</h3>
            <p>Ajuste a busca ou limpe os filtros para ver toda a fila.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">Fila de revisões pedagógicas</caption>
              <thead>
                <tr>
                  <th scope="col">Aluno e atividade</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Enviada em</th>
                  <th scope="col">Aguardando</th>
                  <th scope="col">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody ref={listRef} onKeyDown={onKeyDown}>
                {entries.map((entry, index) => {
                  const cohortNames = entry.cohortNames ?? [];
                  const isSelected = wide && entry.id === selected?.id;
                  return (
                    <tr
                      key={entry.id}
                      data-id={entry.id}
                      className={`${styles.row} yas-reveal`}
                      data-selected={isSelected || undefined}
                      style={{ "--yas-i": Math.min(index, 8) } as CSSProperties}
                      onClick={(event) => {
                        if (!wide || (event.target as HTMLElement).closest("a")) return;
                        select(entry.id);
                      }}
                    >
                      <td className={styles.cellMain}>
                        <StudentAvatar name={entry.studentName} />
                        <span className={styles.who}>
                          <strong>{entry.studentName}</strong>{" "}
                          <span className={styles.activity}>{entry.title}</span>{" "}
                          <small>
                            {cohortNames.length > 0 ? cohortNames.join(", ") : "Sem turma ativa"}
                            {entry.pendingItems > 1 &&
                              ` · ${entry.pendingItems} respostas abertas pendentes`}
                          </small>
                        </span>
                      </td>
                      <td data-label="Tipo">
                        <KindChips entry={entry} />
                      </td>
                      <td data-label="Enviada em" className={styles.cellMuted}>
                        <time dateTime={entry.submittedAt}>
                          {formatSubmitted(entry.submittedAt)}
                        </time>
                      </td>
                      <td data-label="Aguardando">
                        <WaitingChip submittedAt={entry.submittedAt} now={now} />
                      </td>
                      <td className={styles.cellAction}>
                        <Link
                          href={`/teacher/revisoes/${entry.id}`}
                          className={`yas-button yas-button--sm ${
                            index === 0 && filters.order === "oldest" && !filters.after
                              ? "yas-button--secondary"
                              : "yas-button--soft"
                          }`}
                          onFocus={() => wide && entry.id !== selected?.id && select(entry.id)}
                        >
                          Revisar resposta
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {wide && (
              <p className={styles.hint}>
                <kbd>↑</kbd> <kbd>↓</kbd> navegam pela fila · <kbd>Enter</kbd> abre a revisão
              </p>
            )}
            {(nextHref || firstHref) && (
              <nav className={styles.queuePager} aria-label="Páginas da fila">
                <span>
                  {entries.length} de {filteredTotal}{" "}
                  {filteredTotal === 1 ? "prática nesta lista" : "práticas nesta lista"}
                </span>
                {firstHref && (
                  <Link className="yas-button yas-button--ghost yas-button--sm" href={firstHref}>
                    Primeira página
                  </Link>
                )}
                {nextHref && (
                  <Link className="yas-button yas-button--soft yas-button--sm" href={nextHref}>
                    Próxima página
                    <Icon name="arrow" size={16} />
                  </Link>
                )}
              </nav>
            )}
          </div>
        )}

        {wide && selected && (
          <aside className={styles.preview} aria-label="Prévia da resposta selecionada">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={selected.id}
                className={styles.previewInner}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                transition={yasTokens.motion.springs.snappy}
              >
                <ReviewPreview
                  entry={selected}
                  cohorts={selected.cohortNames ?? []}
                  now={now}
                  audioAction={audioAction}
                  onNext={nextOfSelected ? () => select(nextOfSelected.id, true) : undefined}
                />
              </m.div>
            </AnimatePresence>
          </aside>
        )}
      </div>
    </section>
  );
}

function ReviewPreview({
  entry,
  cohorts,
  now,
  audioAction,
  onNext,
}: {
  entry: ReviewQueueEntry;
  cohorts: readonly string[];
  now: number;
  audioAction: (id: string) => Promise<string>;
  onNext: (() => void) | undefined;
}) {
  const [first] = entry.items;
  if (!first) return null;
  const mediaId = typeof first.response.mediaId === "string" ? first.response.mediaId : null;
  const text = typeof first.response.text === "string" ? first.response.text : null;
  const dimensions = rubricDimensionsFor(first.skill, first.responseType);
  return (
    <>
      <div className={styles.previewHead}>
        <StudentAvatar name={entry.studentName} size="lg" />
        <div>
          <h3>{entry.studentName}</h3>
          <p>{cohorts.length > 0 ? cohorts.join(", ") : "Sem turma ativa"}</p>
        </div>
      </div>
      <div className={styles.previewMeta}>
        <KindChips entry={entry} />
        <WaitingChip submittedAt={entry.submittedAt} now={now} />
      </div>
      <div className={styles.previewBlock}>
        <span className={styles.eyebrow}>Atividade</span>
        <strong>{entry.title}</strong>
        {entry.items.length > 1 && (
          <small>
            {entry.pendingItems} respostas abertas para revisar · mostrando 1 de{" "}
            {entry.items.length}
          </small>
        )}
      </div>
      <div className={styles.previewBlock}>
        <span className={styles.eyebrow}>Enunciado</span>
        <p className={styles.prompt}>{first.prompt}</p>
      </div>
      <div className={styles.previewBlock}>
        <span className={styles.eyebrow}>Resposta do aluno</span>
        {mediaId && <AudioPlayer key={mediaId} id={mediaId} action={audioAction} />}
        {text && <blockquote className={styles.quote}>{text}</blockquote>}
        {!mediaId && !text && (
          <p className={styles.mutedText}>Resposta sem conteúdo para prévia.</p>
        )}
      </div>
      <div className={styles.previewBlock}>
        <span className={styles.eyebrow}>Critérios a avaliar</span>
        <ul className={styles.criteria}>
          {dimensions.map((dimension) => (
            <li key={dimension}>
              <Icon name="target" size={14} />
              {RUBRIC_LABELS[dimension]}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.previewActions}>
        <Link className="yas-button yas-button--secondary" href={`/teacher/revisoes/${entry.id}`}>
          Abrir revisão
          <Icon name="arrow" size={16} />
        </Link>
        {onNext && (
          <button type="button" className="yas-button yas-button--ghost" onClick={onNext}>
            Próxima
          </button>
        )}
      </div>
    </>
  );
}
