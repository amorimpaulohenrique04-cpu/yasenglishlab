"use client";

import { ErrorState, PageHeader } from "@/components/ui";

export default function ProgressError({ reset }: { reset: () => void }) {
  return (
    <div className="yas-progress-page">
      <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
      <ErrorState
        title="Não foi possível carregar seu progresso"
        description="Ocorreu uma falha técnica inesperada. Nenhum dado foi convertido em zero."
        action={{ label: "Tentar novamente", onClick: reset }}
      />
    </div>
  );
}
