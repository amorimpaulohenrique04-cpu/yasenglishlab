import { Card, Skeleton } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";

export default function TeacherLoading() {
  return (
    <div
      className={styles.page}
      role="status"
      aria-busy="true"
      aria-label="Carregando área do professor"
    >
      <Skeleton width="16rem" height="2.5rem" />
      <div className={styles.loadingGrid}>
        <Card>
          <Skeleton height="8rem" />
        </Card>
        <Card>
          <Skeleton height="8rem" />
        </Card>
      </div>
    </div>
  );
}
