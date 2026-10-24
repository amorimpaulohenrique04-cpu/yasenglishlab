import { Skeleton } from "@/components/ui";
import { EntryArt } from "@/modules/placement/ui/entry-queue";
import styles from "@/modules/placement/ui/entry-workspace.module.css";
export default function Loading() {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <Skeleton height="4rem" />
      <div className={styles.empty}>
        <EntryArt icon="clock" />
        <p className={styles.loadingText}>Carregando revisões…</p>
      </div>
    </div>
  );
}
