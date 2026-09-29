"use client";

import { ErrorState } from "@/components/ui";

export default function StudentLearningError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar sua trilha"
      description="Seu progresso continua salvo. Tente carregar novamente."
      action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
    />
  );
}
