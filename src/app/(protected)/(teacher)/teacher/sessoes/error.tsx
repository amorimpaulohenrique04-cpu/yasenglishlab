"use client";
import { Button, ErrorState } from "@/components/ui";
export default function SessionsError({ reset }: { reset: () => void }) {
  return (
    <div className="yas-stack">
      <ErrorState
        title="Não foi possível carregar as sessões"
        description="Tente novamente em instantes. Nenhuma operação foi confirmada por esta tela."
      />
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
