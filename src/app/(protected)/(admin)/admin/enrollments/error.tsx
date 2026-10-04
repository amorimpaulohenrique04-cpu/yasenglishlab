"use client";
import { ErrorState } from "@/components/ui";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Fila de matrículas indisponível"
      description="Tente carregar novamente. Nenhum estado foi alterado."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
