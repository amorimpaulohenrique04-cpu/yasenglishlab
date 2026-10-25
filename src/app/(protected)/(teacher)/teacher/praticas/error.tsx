"use client";

import { Button, ErrorState } from "@/components/ui";

export default function TeacherPracticesError({ reset }: { reset: () => void }) {
  return (
    <div className="yas-stack">
      <ErrorState
        title="Não foi possível carregar as práticas"
        description="Tente novamente em instantes."
      />
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
