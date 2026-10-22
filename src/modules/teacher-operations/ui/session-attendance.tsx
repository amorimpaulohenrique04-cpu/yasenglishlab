"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";
import type { TeacherRosterRecord } from "../domain/models";
import { markAttendanceResultAction } from "@/app/(protected)/(teacher)/teacher/sessoes/[sessionId]/actions";
import styles from "./sessions.module.css";

export function SessionAttendance({
  participant,
  sessionId,
  started,
}: {
  participant: TeacherRosterRecord;
  sessionId: string;
  started: boolean;
}) {
  const [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [pending, startTransition] = useTransition();
  const router = useRouter();
  if (participant.bookingStatus !== "BOOKED")
    return <p className={styles.muted}>Esta reserva não está ativa para registrar presença.</p>;
  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        {(["ATTENDED", "NO_SHOW"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={participant.attendanceStatus === status ? "secondary" : "outline"}
            disabled={!started || pending}
            aria-label={`Marcar ${participant.displayName} como ${status === "ATTENDED" ? "Presente" : "Ausente"}`}
            onClick={() => {
              if (
                participant.attendanceStatus &&
                participant.attendanceStatus !== status &&
                reason.trim().length < 3
              ) {
                setMessage("Informe um motivo de 3 a 500 caracteres para corrigir a presença.");
                return;
              }
              const form = new FormData();
              form.set("sessionId", sessionId);
              form.set("sessionBookingId", participant.bookingId);
              form.set("status", status);
              form.set("reason", reason);
              startTransition(async () => {
                try {
                  const result = await markAttendanceResultAction(form);
                  setMessage(result.message);
                  if (result.ok) {
                    setReason("");
                    router.refresh();
                  }
                } catch {
                  setMessage("Não foi possível atualizar a presença. Tente novamente.");
                }
              });
            }}
          >
            {pending ? "Salvando…" : status === "ATTENDED" ? "Presente" : "Ausente"}
          </Button>
        ))}
      </div>
      {participant.attendanceStatus && (
        <Textarea
          label={`Motivo da correção de ${participant.displayName}`}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          message="Obrigatório para alterar uma marcação existente (3 a 500 caracteres)."
        />
      )}
      {!started && <p>A presença será liberada a partir do início da sessão.</p>}
      <p role="status">{message}</p>
    </div>
  );
}
