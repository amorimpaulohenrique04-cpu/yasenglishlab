import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/reviews.module.css";

export default function LoadingReview() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando revisão">
      <Skeleton width="14rem" height="1rem" />
      <Skeleton width="min(24rem, 70%)" height="2.75rem" />
      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <Skeleton height="9rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
          <Skeleton height="30rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
        </div>
        <Skeleton height="20rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
      </div>
      <span className="sr-only">Carregando revisão…</span>
    </div>
  );
}
