"use client";

import { ErrorState } from "@/components/ui";

export default function TeacherCohortsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar as turmas"
      description="Tente novamente em instantes."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
