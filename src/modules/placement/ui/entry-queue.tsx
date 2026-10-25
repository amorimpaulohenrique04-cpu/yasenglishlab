"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { m } from "motion/react";
import { AnimatedNumber } from "@/components/motion";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  EmptyState,
  FilterBar,
  Icon,
  Input,
  Select,
  useToast,
  type IconName,
  type Tint,
} from "@/components/ui";
import {
  entryDate,
  entryDetailUrl,
  entrySkillLabels,
  entryUrl,
  type EntryFilters,
  type EntryQueueData,
} from "../domain/entry-workspace";
import { reviewSlaLabels, reviewSlaStatus } from "../domain/review-sla";
import { TeacherMetric, TeacherMetricGrid } from "@/modules/teacher-operations/ui/teacher-metric";
import styles from "./entry-workspace.module.css";

export function EntryStatus({ status }: { status: "pending" | "draft" | "done" }) {
  return (
    <Badge tone={status === "done" ? "success" : status === "draft" ? "info" : "error"} dot>
      {status === "done" ? "Concluída" : status === "draft" ? "Em revisão" : "Pendente"}
    </Badge>
  );
}
/** "menos de 1h", "5h" or "3 dias" for an elapsed number of hours. */
export const entryElapsed = (hours: number) => {
  const days = Math.floor(hours / 24);
  return hours < 1
    ? "menos de 1h"
    : hours < 24
      ? `${Math.floor(hours)}h`
      : `${days} ${days === 1 ? "dia" : "dias"}`;
};
export function EntrySla({ enteredAt, now }: { enteredAt: string; now: number }) {
  const { status, hours } = reviewSlaStatus(enteredAt, new Date(now));
  return (
    <span className={styles.sla} data-status={status}>
      <Icon name="clock" size={13} />
      {reviewSlaLabels[status]} · há {entryElapsed(hours)}
    </span>
  );
}
/** Large icon "illustration" shared by the loading and empty states. */
export function EntryArt({ icon }: { icon: IconName }) {
  return (
    <span className={styles.art} aria-hidden="true">
      <Icon name={icon} size={44} />
    </span>
  );
}
export const entryInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const metrics: {
  key: keyof EntryQueueData["counts"];
  label: string;
  note: string;
  icon: IconName;
  tone: Tint;
  status: EntryFilters["status"];
}[] = [
  {
    key: "pending",
    label: "Pendentes",
    note: "Aguardam sua revisão",
    icon: "clock",
    tone: "yellow",
    status: "pending",
  },
  {
    key: "draft",
    label: "Em revisão",
    note: "Rascunhos salvos por você",
    icon: "file",
    tone: "lilac",
    status: "draft",
  },
  {
    key: "overdue",
    label: "Urgentes",
    note: "Há 24h ou mais",
    icon: "alert",
    tone: "red",
    status: "overdue",
  },
  {
    key: "today",
    label: "Concluídas hoje",
    note: "Recomendações disponíveis",
    icon: "check-c",
    tone: "green",
    status: "completed_today",
  },
];

export function EntryQueue({
  data,
  filters,
  now,
}: {
  data: EntryQueueData;
  filters: EntryFilters;
  now: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const [serverQuery, setServerQuery] = useState(filters.q);
  if (serverQuery !== filters.q) {
    setServerQuery(filters.q);
    setQuery(filters.q);
  }
  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(
      () =>
        startTransition(() =>
          router.replace(entryUrl(filters, { q: query, page: 1 }), { scroll: false }),
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [query, filters, router]);
  const go = (patch: Partial<EntryFilters>) =>
    startTransition(() =>
      router.replace(entryUrl(filters, { ...patch, page: 1 }), { scroll: false }),
    );
  const goPage = (to: number) =>
    startTransition(() => router.replace(entryUrl(filters, { page: to }), { scroll: false }));
  const hasFilters = !!filters.q || !!filters.cohort || filters.status !== "active";
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(
        new URL(entryDetailUrl(id, filters), window.location.origin).toString(),
      );
      toast({ tone: "success", title: "Link copiado" });
    } catch {
      toast({ tone: "error", title: "Não foi possível copiar o link" });
    }
  };
  return (
    <>
      <TeacherMetricGrid label="Resumo das revisões de entrada">
        {metrics.map((metric, index) => {
          const active = filters.status === metric.status;
          return (
            <TeacherMetric
              key={metric.key}
              icon={metric.icon}
              tone={metric.tone}
              label={metric.label}
              value={<AnimatedNumber value={data.counts[metric.key]} />}
              caption={metric.note}
              pressed={active}
              onClick={() => go({ status: active ? "active" : metric.status })}
              enterStep={index}
            />
          );
        })}
      </TeacherMetricGrid>
      <section className={styles.queue} aria-labelledby="entry-queue-title" aria-busy={pending}>
        <h2 id="entry-queue-title" className="sr-only">
          Fila de testes de entrada
        </h2>
        <FilterBar aria-label="Filtrar revisões de entrada" onSubmit={(e) => e.preventDefault()}>
          <Input
            type="search"
            label="Buscar"
            placeholder="Aluno, turma ou habilidade…"
            value={query}
            maxLength={120}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => go({ status: e.target.value as EntryFilters["status"] })}
            options={[
              { value: "active", label: "Aguardando conclusão" },
              { value: "all", label: "Todos os status" },
              { value: "pending", label: "Pendentes" },
              { value: "draft", label: "Em revisão" },
              { value: "overdue", label: "Urgentes · há 24h ou mais" },
              { value: "completed_today", label: "Concluídas hoje" },
              { value: "done", label: "Todas as concluídas" },
            ]}
          />
          {data.cohorts.length > 0 && (
            <Select
              label="Turma"
              value={filters.cohort}
              onChange={(e) => go({ cohort: e.target.value })}
              options={[
                { value: "", label: "Todas as turmas" },
                ...data.cohorts.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}
          <Select
            label="Ordenar"
            value={filters.order}
            onChange={(e) => go({ order: e.target.value as EntryFilters["order"] })}
            options={[
              { value: "oldest", label: "Mais antigas primeiro" },
              { value: "newest", label: "Mais recentes primeiro" },
            ]}
          />
        </FilterBar>
        <div className={styles.resultCount} role="status">
          <span>
            {data.total} {data.total === 1 ? "revisão" : "revisões"}
            {pending ? " · Atualizando…" : ""}
          </span>
          {hasFilters && (
            <button
              type="button"
              className="yas-link"
              onClick={() => {
                setQuery("");
                go({ q: "", status: "active", cohort: "" });
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
        {data.items.length ? (
          <ul className={styles.rows}>
            {data.items.map((row) => {
              const urgent =
                row.status !== "done" &&
                reviewSlaStatus(row.enteredReviewAt, new Date(now)).status === "OVERDUE";
              const href = entryDetailUrl(row.id, filters);
              return (
                <m.li
                  key={row.id}
                  className={styles.row}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className={styles.person}>
                    <Avatar fallback={entryInitials(row.name)} label={row.name} />
                    <div>
                      <h3>
                        {row.name}
                        {urgent && (
                          <Badge tone="error" icon="alert">
                            Urgente
                          </Badge>
                        )}
                      </h3>
                      <p>{row.cohort ?? "Aguardando turma"}</p>
                    </div>
                  </div>
                  <div className={styles.rowEvidence}>
                    <small>
                      {row.submittedAt ? (
                        <>
                          Enviado há{" "}
                          {entryElapsed(
                            Math.max(0, (now - new Date(row.submittedAt).getTime()) / 3_600_000),
                          )}{" "}
                          · <time dateTime={row.submittedAt}>{entryDate(row.submittedAt)}</time>
                        </>
                      ) : (
                        "Data de envio indisponível"
                      )}
                    </small>
                    <div className={styles.chips}>
                      {row.skills.map((skill) => (
                        <Badge key={skill} tone="muted">
                          {entrySkillLabels[skill.toUpperCase()] ?? skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <EntryStatus status={row.status} />
                  <div className={styles.rowActions}>
                    <Link className="yas-button yas-button--secondary yas-button--sm" href={href}>
                      <span>
                        {row.status === "done"
                          ? "Ver revisão"
                          : row.status === "draft"
                            ? "Continuar"
                            : "Abrir revisão"}
                      </span>
                      <Icon name="arrow" size={16} />
                    </Link>
                    <Dropdown
                      iconOnly
                      label={`Mais ações para ${row.name}`}
                      items={[
                        { id: "open", label: "Abrir revisão", href, icon: "arrow" },
                        {
                          id: "copy",
                          label: "Copiar link",
                          icon: "link",
                          onSelect: () => void copyLink(row.id),
                        },
                      ]}
                    />
                  </div>
                </m.li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.empty}>
            <EntryArt icon={hasFilters ? "search" : "check-c"} />
            <EmptyState
              title={hasFilters ? "Nenhuma revisão encontrada" : "Nenhuma revisão pendente"}
              description={
                hasFilters
                  ? "Ajuste a busca ou os filtros para encontrar outros testes."
                  : "Os testes no seu escopo estão em dia. Você pode continuar nas revisões de prática."
              }
            />
            {!hasFilters && (
              <Link className="yas-button yas-button--secondary" href="/teacher/revisoes">
                <span>Ver revisões de prática</span>
              </Link>
            )}
          </div>
        )}
        {lastPage > 1 && (
          <nav className={styles.pagination} aria-label="Páginas da fila">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1 || pending}
              onClick={() => goPage(filters.page - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {filters.page} de {lastPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= lastPage || pending}
              onClick={() => goPage(filters.page + 1)}
            >
              Próxima
            </Button>
          </nav>
        )}
      </section>
    </>
  );
}
