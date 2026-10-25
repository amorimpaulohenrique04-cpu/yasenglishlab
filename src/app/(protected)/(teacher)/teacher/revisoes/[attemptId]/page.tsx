import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Breadcrumbs, Icon, PageHeader } from "@/components/ui";
import { groupReviewQueue, queueNeighbors } from "@/modules/teacher-operations/domain/review-queue";
import { ReviewDetail } from "@/modules/teacher-operations/ui/review-detail";
import styles from "@/modules/teacher-operations/ui/reviews.module.css";
import { loadReviewContext, loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import { reviewPracticeAction, teacherAudioPlaybackAction } from "../actions";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ save?: string }>;
}) {
  const { attemptId } = await params;
  const [items, queue, context, query] = await Promise.all([
    loadTeacherReviews(attemptId),
    loadTeacherReviews(),
    loadReviewContext(attemptId),
    searchParams,
  ]);
  const [first] = items;
  if (!first || !context) notFound();
  const nav = queueNeighbors(groupReviewQueue(queue), attemptId);
  // Outside the queue (already reviewed), queueNeighbors points "next" at the oldest pending attempt.
  const next = nav.next;

  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Revisões", href: "/teacher/revisoes" }, { label: "Revisão de resposta" }]}
      />
      <PageHeader
        title="Revisão de resposta"
        description={`${first.title} · ${first.studentName ?? "Aluno"}`}
        actions={
          <nav className={styles.pager} aria-label="Navegar pela fila">
            {nav.prev ? (
              <Link
                className={styles.pagerButton}
                href={`/teacher/revisoes/${nav.prev}`}
                aria-label="Revisão anterior"
              >
                <Icon name="left" size={18} />
              </Link>
            ) : (
              <span className={styles.pagerButton} aria-hidden="true" data-disabled="">
                <Icon name="left" size={18} />
              </span>
            )}
            <span className={styles.pagerLabel}>
              {nav.position === null ? (
                <>{nav.total} na fila</>
              ) : (
                <>
                  <strong className="yas-tabular">{nav.position}</strong> de{" "}
                  <span className="yas-tabular">{nav.total}</span>
                </>
              )}
            </span>
            {next ? (
              <Link
                className={styles.pagerButton}
                href={`/teacher/revisoes/${next}`}
                aria-label="Próxima revisão"
              >
                <Icon name="right" size={18} />
              </Link>
            ) : (
              <span className={styles.pagerButton} aria-hidden="true" data-disabled="">
                <Icon name="right" size={18} />
              </span>
            )}
          </nav>
        }
      />
      {query.save === "error" && (
        <Alert
          tone="error"
          title="Revisão rejeitada"
          description="O vínculo pode ter mudado ou outro professor já concluiu esta revisão."
        />
      )}
      <ReviewDetail
        items={items}
        studentName={first.studentName ?? "Aluno"}
        cohortNames={context.cohortNames}
        mediaDurationSeconds={context.mediaDurationSeconds}
        saved={context.reviews}
        next={next}
        saveSuccess={query.save === "success"}
        now={sessionWorkspaceNow()}
        reviewAction={reviewPracticeAction}
        audioAction={teacherAudioPlaybackAction}
      />
    </div>
  );
}
