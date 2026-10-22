"use client";
import { useState, useTransition } from "react";
import { Button, Icon } from "@/components/ui";
import type { JoinAccess } from "@/modules/schedule/application/meeting-provider";

import styles from "./schedule.module.css";

const labels = {
  NOT_AUTHORIZED: "Acesso não autorizado.",
  TOO_EARLY: "O acesso abre 15 minutos antes do encontro.",
  MEETING_NOT_READY: "O professor ainda não disponibilizou a reunião.",
  SESSION_CLOSED: "Este encontro está encerrado.",
};
const suspendedLabel =
  "Sua reserva está guardada, mas a entrada está em pausa até a assinatura ser regularizada.";
export function JoinMeeting({
  sessionId,
  action,
  block = false,
}: {
  sessionId: string;
  action: (id: string) => Promise<JoinAccess>;
  /** Full-width, large primary action (teacher session page). */
  block?: boolean;
}) {
  const [result, setResult] = useState<JoinAccess | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className={styles.join}>
      <Button
        size={block ? "lg" : "sm"}
        variant="secondary"
        className={block ? "yas-button--block" : undefined}
        disabled={pending}
        leadingIcon={<Icon name="video" size={16} />}
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
      <div role="status" className={styles.joinStatus}>
        {error ? (
          "Não foi possível consultar o acesso. Tente novamente."
        ) : result?.status === "AVAILABLE" ? (
          <a
            className="yas-button yas-button--primary yas-button--sm"
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir reunião
          </a>
        ) : result ? (
          result.status === "NOT_AUTHORIZED" && result.reason === "SUBSCRIPTION_SUSPENDED" ? (
            suspendedLabel
          ) : (
            labels[result.status]
          )
        ) : null}
      </div>
    </div>
  );
}
