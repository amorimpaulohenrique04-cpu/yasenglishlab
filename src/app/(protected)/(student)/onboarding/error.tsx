"use client";
import { ErrorState } from "@/components/ui";
export default function OnboardingError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar sua entrada"
      description="Seu progresso salvo foi preservado. Tente novamente."
      action={{ label: "Tentar novamente", onClick: reset }}
    />
  );
}
