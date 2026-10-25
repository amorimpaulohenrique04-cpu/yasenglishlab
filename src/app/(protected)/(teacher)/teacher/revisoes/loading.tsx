import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/reviews.module.css";

export default function LoadingReviews() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando revisões">
      <Skeleton width="9rem" height="1rem" />
      <Skeleton width="min(20rem, 70%)" height="2.75rem" />
      <div className={styles.kpis}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="6.5rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
        ))}
      </div>
      <Skeleton height="26rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
      <span className="sr-only">Carregando revisões…</span>
    </div>
  );
}
