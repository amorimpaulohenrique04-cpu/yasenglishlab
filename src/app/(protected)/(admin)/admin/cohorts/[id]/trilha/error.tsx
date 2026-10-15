"use client";
import { Alert, Button } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div>
      <Alert
        tone="error"
        title="Trilha indisponível"
        description="Não foi possível carregar a trilha da turma. Tente novamente."
      />
      <Button type="button" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
