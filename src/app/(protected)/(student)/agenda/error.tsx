"use client";

import { ErrorState } from "@/components/ui";

export default function AgendaError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar a Agenda"
      description="Suas reservas continuam salvas. Tente novamente."
      action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
    />
  );
}
