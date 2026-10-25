import { Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/cohorts.module.css";

export default function LoadingTeacherCohorts() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando turmas">
      <Skeleton width="12rem" height="3rem" />
      <div className={styles.stats} aria-hidden="true">
        {[0, 1, 2, 3].map((id) => (
          <Skeleton key={id} height="7rem" />
        ))}
      </div>
      <div className={styles.grid} aria-hidden="true">
        {[0, 1, 2].map((id) => (
          <Skeleton key={id} height="30rem" />
        ))}
      </div>
    </div>
  );
}
