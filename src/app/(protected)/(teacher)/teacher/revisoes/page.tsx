import Link from "next/link";
import { Breadcrumbs, Icon, PageHeader } from "@/components/ui";
import {
  formatQueueCursor,
  formatWaiting,
  parseQueueCursor,
  parseQueueFilters,
  queueUrl,
  reviewKind,
  type ReviewQueueEntry,
} from "@/modules/teacher-operations/domain/review-queue";
import { ReviewKpis } from "@/modules/teacher-operations/ui/review-kpis";
import { ReviewQueue } from "@/modules/teacher-operations/ui/review-queue";
import styles from "@/modules/teacher-operations/ui/reviews.module.css";
import { loadReviewOverview, loadReviewQueuePage } from "@/server/teacher-operations/pedagogy";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import { teacherAudioPlaybackAction } from "./actions";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseQueueFilters(await searchParams);
  // Filters, order and the page cut run in the database, by attempt: a practice is never split
  // across pages and every pending answer of a listed practice comes along.
  const [page, overview] = await Promise.all([
    loadReviewQueuePage({
      tab: filters.tab,
      q: filters.q,
      cohort: filters.cohort,
      order: filters.order,
      after: parseQueueCursor(filters.after),
    }),
    loadReviewOverview(),
  ]);
  const now = sessionWorkspaceNow();
  const visible: ReviewQueueEntry[] = page.entries.map((entry) => ({
    ...entry,
    studentName: entry.studentName ?? "Aluno",
    kind: entry.items[0]
      ? reviewKind(entry.items[0].skill, entry.items[0].responseType)
      : (entry.kinds[0] ?? "speaking"),
  }));
  const nextHref =
    page.hasMore && page.nextCursor
      ? queueUrl(filters, { after: formatQueueCursor(page.nextCursor), item: "" })
      : null;
  const firstHref = filters.after ? queueUrl(filters, { after: "", item: "" }) : null;

  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Revisões" }]}
      />
      <PageHeader
        title="Revisões"
        description="Ouça, avalie e devolva feedback às práticas dos seus alunos."
        actions={
          <Link
            className="yas-button yas-button--ghost yas-button--sm"
            href="/teacher/revisoes/placement"
          >
            Ver revisões de entrada
            <Icon name="arrow" size={16} />
          </Link>
        }
      />
      <ReviewKpis
        pending={page.total}
        over24h={page.counts.over24h}
        oldestLabel={page.oldestSubmittedAt ? formatWaiting(page.oldestSubmittedAt, now) : null}
        reviewedToday={overview.reviewedToday}
        reviewedYesterday={overview.reviewedYesterday}
        avg7d={overview.avgResponseMinutes7d}
        avgPrev7d={overview.avgResponseMinutesPrev7d}
      />
      {page.total === 0 ? (
        <section className={`${styles.zero} yas-reveal`} aria-labelledby="zero-title">
          <span className={styles.zeroArt} aria-hidden="true">
            <Icon name="trophy" size={34} />
            <i />
            <i />
            <i />
          </span>
          <h2 id="zero-title">Fila zerada!</h2>
          <p>
            Nenhuma prática aguardando revisão. Novas respostas dos seus alunos aparecem aqui assim
            que forem enviadas.
          </p>
        </section>
      ) : (
        <ReviewQueue
          entries={visible}
          total={page.total}
          filteredTotal={page.filteredTotal}
          counts={page.counts}
          filters={filters}
          cohorts={page.cohorts}
          now={now}
          nextHref={nextHref}
          firstHref={firstHref}
          audioAction={teacherAudioPlaybackAction}
        />
      )}
    </div>
  );
}
