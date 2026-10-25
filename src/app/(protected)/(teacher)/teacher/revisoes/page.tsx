import Link from "next/link";
import { Breadcrumbs, Icon, PageHeader } from "@/components/ui";
import {
  filterQueue,
  formatWaiting,
  groupReviewQueue,
  parseQueueFilters,
  queueCounts,
} from "@/modules/teacher-operations/domain/review-queue";
import { ReviewKpis } from "@/modules/teacher-operations/ui/review-kpis";
import { ReviewQueue } from "@/modules/teacher-operations/ui/review-queue";
import styles from "@/modules/teacher-operations/ui/reviews.module.css";
import { loadReviewOverview, loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import { teacherAudioPlaybackAction } from "./actions";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [items, overview, query] = await Promise.all([
    loadTeacherReviews(),
    loadReviewOverview(),
    searchParams,
  ]);
  const now = sessionWorkspaceNow();
  const queue = groupReviewQueue(items);
  const filters = parseQueueFilters(query);
  const visible = filterQueue(queue, filters, overview.studentCohorts, now);
  const counts = queueCounts(queue, now);
  const oldest = queue.reduce<string | null>(
    (min, entry) => (min === null || entry.submittedAt < min ? entry.submittedAt : min),
    null,
  );
  const cohorts = [
    ...new Set(queue.flatMap((entry) => overview.studentCohorts[entry.studentId] ?? [])),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

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
        pending={queue.length}
        over24h={counts.over24h}
        oldestLabel={oldest ? formatWaiting(oldest, now) : null}
        reviewedToday={overview.reviewedToday}
        reviewedYesterday={overview.reviewedYesterday}
        avg7d={overview.avgResponseMinutes7d}
        avgPrev7d={overview.avgResponseMinutesPrev7d}
      />
      {queue.length === 0 ? (
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
          total={queue.length}
          counts={counts}
          filters={filters}
          cohorts={cohorts}
          studentCohorts={overview.studentCohorts}
          now={now}
          audioAction={teacherAudioPlaybackAction}
        />
      )}
    </div>
  );
}
