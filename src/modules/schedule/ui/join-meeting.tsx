"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import type { JoinAccess } from "@/modules/schedule/application/meeting-provider";

const labels = {
  NOT_AUTHORIZED: "Acesso não autorizado.",
  TOO_EARLY: "O acesso abre 15 minutos antes do encontro.",
  MEETING_NOT_READY: "O professor ainda não disponibilizou a reunião.",
  SESSION_CLOSED: "Este encontro está encerrado.",
};
export function JoinMeeting({
  sessionId,
  action,
}: {
  sessionId: string;
  action: (id: string) => Promise<JoinAccess>;
}) {
  const [result, setResult] = useState<JoinAccess | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false);
            try {
              setResult(await action(sessionId));
            } catch {
              setError(true);
            }
          })
        }
      >
        {pending ? "Consultando acesso…" : "Entrar no encontro"}
      </Button>
      <div role="status">
        {error ? (
          "Não foi possível consultar o acesso. Tente novamente."
        ) : result?.status === "AVAILABLE" ? (
          <a href={result.url} target="_blank" rel="noopener noreferrer">
            Abrir reunião
          </a>
        ) : result ? (
          labels[result.status]
        ) : null}
      </div>
    </div>
  );
}
