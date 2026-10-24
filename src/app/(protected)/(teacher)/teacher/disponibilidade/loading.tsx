import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/availability-workspace.module.css";
export default function Loading() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando disponibilidade">
      <Skeleton height="4rem" />
      <div className={styles.metrics}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="6rem" />
        ))}
      </div>
      <div className={styles.workspace}>
        <Skeleton height="32rem" />
        <Skeleton height="30rem" />
      </div>
    </div>
  );
}
