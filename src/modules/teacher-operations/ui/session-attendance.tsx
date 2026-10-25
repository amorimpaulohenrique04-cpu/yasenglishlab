"use client";

import { AnimatePresence, m } from "motion/react";
import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Icon, Textarea } from "@/components/ui";
import { markAttendanceResultAction } from "@/app/(protected)/(teacher)/teacher/sessoes/[sessionId]/actions";
import {
  teacherAttendanceLabel,
  type TeacherAttendanceStatus,
  type TeacherRosterRecord,
} from "../domain/models";
import { initials } from "../domain/session-calendar";
import styles from "./sessions.module.css";

const bookingLabel = {
  BOOKED: "Reserva ativa",
  CANCELLED: "Reserva cancelada",
  TEACHER_CANCELLED: "Cancelada pelo professor",
} as const;

const choices = [
  { status: "ATTENDED", label: "Presente", icon: "check" },
  { status: "NO_SHOW", label: "Ausente", icon: "x" },
] as const;

/**
 * One participant with an optimistic attendance toggle. Changing an existing mark asks for a
 * correction reason first; failures roll the toggle back and explain why.
 */
export function SessionAttendance({
  participant,
  sessionId,
  started,
  index = 0,
}: {
  participant: TeacherRosterRecord;
  sessionId: string;
  started: boolean;
  index?: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TeacherAttendanceStatus | null>(
      participant.attendanceStatus,
    ),
    [correcting, setCorrecting] = useState<TeacherAttendanceStatus | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null),
    [pending, startTransition] = useTransition();
  const active = participant.bookingStatus === "BOOKED";

  const submit = (next: TeacherAttendanceStatus, why: string) => {
    const previous = status;
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set("sessionBookingId", participant.bookingId);
    form.set("status", next);
    form.set("reason", why);
    setStatus(next);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await markAttendanceResultAction(form);
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) {
          setCorrecting(null);
          setReason("");
          router.refresh();
        } else setStatus(previous);
      } catch {
        setStatus(previous);
        setMessage({ ok: false, text: "Não foi possível atualizar a presença. Tente novamente." });
      }
    });
  };

  return (
    <li className={styles.person} style={{ "--yas-i": Math.min(index, 8) } as CSSProperties}>
      <span className={styles.personAvatar} data-tone={index % 4} aria-hidden="true">
        {initials(participant.displayName)}
      </span>
      <div className={styles.personInfo}>
        <h3>{participant.displayName}</h3>
        <small>{bookingLabel[participant.bookingStatus]}</small>
      </div>
      <Badge
        tone={status === "ATTENDED" ? "success" : status === "NO_SHOW" ? "error" : "neutral"}
        dot
        className={styles.personBadge}
      >
        {active ? teacherAttendanceLabel(status) : "Sem presença"}
      </Badge>
      {active ? (
        <div
          className={styles.toggle}
          role="group"
          aria-label={`Presença de ${participant.displayName}`}
        >
          {choices.map((choice) => (
            <button
              key={choice.status}
              type="button"
              className={styles.toggleOption}
              data-choice={choice.status}
              aria-pressed={status === choice.status}
              disabled={!started || pending}
              aria-label={`Marcar ${participant.displayName} como ${choice.label}`}
              onClick={() => {
                if (status && status !== choice.status && reason.trim().length < 3) {
                  setCorrecting(choice.status);
                  setMessage(null);
                  return;
                }
                submit(choice.status, reason);
              }}
            >
              <Icon name={choice.icon} size={15} strokeWidth={2.6} />
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <span className={styles.muted}>Reserva inativa</span>
      )}
      <AnimatePresence initial={false}>
        {correcting && (
          <m.div
            className={styles.correction}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <div className={styles.correctionInner}>
              <Textarea
                label={`Motivo da correção de ${participant.displayName}`}
                maxLength={500}
                value={reason}
                rows={2}
                onChange={(event) => setReason(event.target.value)}
                message="Obrigatório para alterar uma marcação existente (3 a 500 caracteres)."
              />
              <div className={styles.correctionActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCorrecting(null);
                    setReason("");
                  }}
                >
                  Desistir
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pending}
                  disabled={reason.trim().length < 3}
                  onClick={() => submit(correcting, reason)}
                >
                  Confirmar correção para {correcting === "ATTENDED" ? "Presente" : "Ausente"}
                </Button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <p role="status" className={styles.personStatus} data-ok={message?.ok || undefined}>
        {message?.text}
      </p>
    </li>
  );
}
