"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Button, Dialog } from "@/components/ui";
import { CancellationNotice } from "./cancellation-notice";
import {
  cancelErrorMessages,
  confirmationDescription,
  type CancelErrorCode,
} from "./cancellation-copy";
import styles from "./billing.module.css";

export type CancelSubscriptionResult =
  | { kind: "cancel_requested"; accessUntil: string | null; alreadyRequested: boolean }
  | { kind: "error"; code: CancelErrorCode };

// Owns the whole cancellation area of an ACTIVE subscription so the success message is not unmounted when
// the page revalidates: scheduled (from server or from this action) renders the notice, otherwise the button.
export function CancelSubscription({
  action,
  scheduled,
  accessUntil,
}: {
  action: () => Promise<CancelSubscriptionResult>;
  scheduled: boolean;
  accessUntil: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ accessUntil: string | null } | null>(null);
  const [error, setError] = useState<CancelErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);

  if (scheduled || done) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status">
        <CancellationNotice accessUntil={done?.accessUntil ?? accessUntil} />
      </div>
    );
  }

  const confirm = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.kind === "cancel_requested") {
          setDone({ accessUntil: result.accessUntil ?? accessUntil });
          setOpen(false);
          requestAnimationFrame(() => statusRef.current?.focus());
        } else {
          setError(result.code);
        }
      } catch {
        setError("UNAVAILABLE");
      }
    });
  };

  const message = error ? cancelErrorMessages[error] : null;
  return (
    <div className={styles.cancelArea}>
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Cancelar assinatura
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title="Cancelar sua assinatura?"
        description={confirmationDescription(accessUntil)}
        actions={
          <>
            <Button variant="primary" disabled={pending} onClick={() => setOpen(false)}>
              Manter assinatura
            </Button>
            <Button variant="danger" loading={pending} onClick={confirm}>
              {pending ? "Cancelando…" : "Sim, cancelar assinatura"}
            </Button>
          </>
        }
      >
        {message && <Alert tone="error" title={message.title} description={message.description} />}
      </Dialog>
    </div>
  );
}
