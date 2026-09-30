"use client";

import { ErrorState } from "@/components/ui";

export default function MaterialsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar os materiais"
      description="Tente novamente. Nenhum acesso protegido foi liberado sem autorização."
      action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
    />
  );
}
