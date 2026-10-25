import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";

export default function LoadingSessions() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando sessões">
      <Skeleton width="9rem" height="1rem" />
      <div className={styles.skeletonHeader}>
        <Skeleton width="min(22rem, 70%)" height="2.75rem" />
        <Skeleton width="10rem" height="3.25rem" />
      </div>
      <Skeleton height="7.5rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
      <div className={styles.layout}>
        <div className={styles.main}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonGroup}>
              <Skeleton width="16rem" height="1.25rem" />
              <Skeleton height="6.5rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
            </div>
          ))}
        </div>
        <div className={styles.aside}>
          <Skeleton height="18rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
          <Skeleton height="9rem" style={{ borderRadius: "var(--yas-radius-lg)" }} />
        </div>
      </div>
      <span className="sr-only">Carregando sessões…</span>
    </div>
  );
}
