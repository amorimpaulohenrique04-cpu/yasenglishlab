"use client";

import { ErrorState } from "@/components/ui";

export default function LessonError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar a aula"
      description="Seu progresso continua salvo. Tente carregar o conteúdo novamente."
      action={{ label: "Tentar novamente", variant: "secondary", onClick: reset }}
    />
  );
}
