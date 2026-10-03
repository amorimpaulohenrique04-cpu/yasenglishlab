"use client";
import { ErrorState } from "@/components/ui";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Avaliação indisponível"
      description="Confira seu escopo de acesso. Nenhuma recomendação foi alterada."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
