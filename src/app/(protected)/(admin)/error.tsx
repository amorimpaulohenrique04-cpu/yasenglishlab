"use client";

import { Button, ErrorState } from "@/components/ui";
import styles from "@/modules/admin-content/ui/admin-content.module.css";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.page}>
      <ErrorState
        title="A área administrativa não carregou"
        description="Tente carregar a página novamente."
      />
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
