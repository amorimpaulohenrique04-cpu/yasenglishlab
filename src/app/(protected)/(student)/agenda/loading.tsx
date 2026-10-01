import { PageHeader, Skeleton } from "@/components/ui";

import styles from "@/modules/schedule/ui/schedule.module.css";

export default function AgendaLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Carregando Agenda">
      <PageHeader title="Agenda" description="Preparando suas próximas sessões." />
      <Skeleton height="5rem" />
      <div className={styles.layout}>
        <Skeleton height="28rem" />
        <Skeleton height="20rem" />
      </div>
    </div>
  );
}
