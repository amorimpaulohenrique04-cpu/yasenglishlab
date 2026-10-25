import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/practice-list.module.css";

export default function LoadingTeacherPractices() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando práticas">
      <div className="yas-page-header">
        <div>
          <Skeleton width="10rem" height="2rem" />
          <Skeleton width="min(25rem, 75vw)" height="1rem" />
        </div>
        <Skeleton width="9rem" height="2.75rem" />
      </div>
      <Skeleton height="3rem" style={{ borderRadius: "var(--yas-radius-md)" }} />
      <div className={styles.tabs} aria-hidden="true">
        <Skeleton width="6rem" height="2.5rem" />
        <Skeleton width="8rem" height="2.5rem" />
        <Skeleton width="8rem" height="2.5rem" />
      </div>
      <div className={styles.list} aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div className={styles.card} key={row}>
            <Skeleton width="4rem" height="4rem" style={{ borderRadius: "var(--yas-radius-md)" }} />
            <div className={styles.cardMain}>
              <Skeleton width="min(21rem, 70%)" height="1.25rem" />
              <Skeleton width="min(34rem, 95%)" height="1rem" />
              <Skeleton width="min(28rem, 80%)" height="0.875rem" />
            </div>
            <Skeleton width="9rem" height="2.5rem" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando práticas…</span>
    </div>
  );
}
