"use client";
import { Button, ErrorState } from "@/components/ui";
export default function ReviewsError({ reset }: { reset: () => void }) {
  return (
    <div className="yas-stack">
      <ErrorState
        title="Não foi possível carregar as revisões"
        description="Tente novamente em instantes. Nenhuma revisão foi enviada por esta tela."
      />
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
