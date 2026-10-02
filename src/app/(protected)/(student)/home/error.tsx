"use client";

import { ErrorState } from "@/components/ui";

export default function HomeError({ reset }: { reset: () => void }) {
  return (
    <div className="yas-home-page">
      <ErrorState
        title="Não foi possível carregar o início"
        description="Seu progresso continua salvo. Tente carregar a Home novamente."
        action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
      />
    </div>
  );
}
