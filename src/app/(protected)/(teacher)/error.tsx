"use client";

import { ErrorState } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";

export default function TeacherError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.page}>
      <ErrorState
        title="Não foi possível carregar a área do professor"
        description="Tente novamente. Nenhuma alteração foi tratada como sucesso."
        action={{ label: "Tentar novamente", onClick: reset }}
      />
    </div>
  );
}
