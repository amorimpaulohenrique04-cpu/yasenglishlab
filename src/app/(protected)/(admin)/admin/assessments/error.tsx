"use client";
import { Alert, Button } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div>
      <Alert
        tone="error"
        title="Avaliações indisponíveis"
        description="Não foi possível carregar os dados. Tente novamente."
      />
      <Button type="button" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
