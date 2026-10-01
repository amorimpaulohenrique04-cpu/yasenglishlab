import { Card, Skeleton } from "@/components/ui";

import styles from "@/modules/admin-content/ui/admin-content.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.page} aria-label="Carregando administração de conteúdo" aria-busy="true">
      <Skeleton height="2.5rem" width="55%" />
      <Skeleton height="1.25rem" width="80%" />
      <Card className={styles.itemCard}>
        <Skeleton height="2rem" width="35%" />
        <Skeleton height="4rem" />
      </Card>
    </div>
  );
}
