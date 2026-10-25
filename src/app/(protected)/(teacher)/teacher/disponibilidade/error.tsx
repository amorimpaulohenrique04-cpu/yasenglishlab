"use client";
import { ErrorState } from "@/components/ui";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Disponibilidade indisponível"
      description="Não foi possível carregar os horários. Nenhuma alteração foi realizada."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
