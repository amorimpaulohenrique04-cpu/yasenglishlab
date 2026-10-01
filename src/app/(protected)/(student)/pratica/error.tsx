"use client";

import { ErrorState } from "@/components/ui";

export default function PracticeError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar a Prática"
      description="Suas tentativas continuam salvas. Tente novamente."
      action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
    />
  );
}
