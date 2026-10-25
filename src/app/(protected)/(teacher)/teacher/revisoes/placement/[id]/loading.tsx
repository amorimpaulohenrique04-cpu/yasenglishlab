import { Skeleton } from "@/components/ui";
import styles from "@/modules/placement/ui/entry-workspace.module.css";
export default function Loading() {
  return (
    <div className={styles.page} role="status" aria-label="Carregando teste de entrada">
      <Skeleton height="5rem" />
      <Skeleton height="6rem" />
      <div className={styles.workspace}>
        <Skeleton height="26rem" />
        <Skeleton height="26rem" />
      </div>
    </div>
  );
}
