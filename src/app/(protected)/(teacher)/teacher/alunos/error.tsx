"use client";
import { ErrorState } from "@/components/ui";
export default function StudentsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Acompanhamento indisponível"
      description="Não foi possível carregar os registros autorizados. Tente novamente em alguns instantes."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
