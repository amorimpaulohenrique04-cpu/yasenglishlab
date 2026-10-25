"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, Drawer, Icon, useToast } from "@/components/ui";
import {
  cancelSessionResultAction,
  saveSessionResultAction,
} from "@/app/(protected)/(teacher)/teacher/sessoes/actions";
import {
  sessionCanCancel,
  sessionCanEdit,
  type SessionWorkspace,
  type WorkspaceSession,
} from "../domain/session-workspace";
import { SessionForm } from "./session-form";
import { MeetingSheet } from "./session-sheets";
import styles from "./sessions.module.css";

/** Edit (sheet), room link (sheet) and cancel (confirmation) for one session. */
export function SessionActions({
  session,
  context,
  now,
  initialEdit = false,
  initialCancel = false,
  initialMeeting = false,
  returnTo = "/teacher/sessoes",
}: {
  session: WorkspaceSession;
  context: SessionWorkspace;
  now: number;
  initialEdit?: boolean;
  initialCancel?: boolean;
  initialMeeting?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const canEdit = sessionCanEdit(session, now),
    canCancel = sessionCanCancel(session);
  const [edit, setEdit] = useState(initialEdit && canEdit),
    [cancel, setCancel] = useState(initialCancel && canCancel),
    [meeting, setMeeting] = useState(initialMeeting && canEdit),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  if (!canEdit && !canCancel) return null;
  return (
    <div className={styles.actionButtons}>
      {canEdit && (
        <Button
          variant="outline"
          leadingIcon={<Icon name="pen" size={16} />}
          onClick={() => setEdit(true)}
        >
          Editar sessão
        </Button>
      )}
      {canEdit && (
        <Button
          variant="outline"
          leadingIcon={<Icon name="link" size={16} />}
          onClick={() => setMeeting(true)}
        >
          Cadastrar link do Meet
        </Button>
      )}
      {canCancel && (
        <Button
          variant="danger"
          leadingIcon={<Icon name="trash" size={16} />}
          onClick={() => {
            setError("");
            setCancel(true);
          }}
        >
          Cancelar sessão
        </Button>
      )}
      <Drawer
        open={edit}
        size="lg"
        icon="pen"
        onOpenChange={(open) => {
          if (!open && dirty && !window.confirm("Descartar as alterações desta sessão?")) return;
          setEdit(open);
          if (!open) setDirty(false);
        }}
        title="Editar sessão"
        description="Ajustes de horário e estrutura ficam bloqueados quando já há reservas."
      >
        {edit && (
          <SessionForm
            context={context}
            session={session}
            action={saveSessionResultAction}
            returnTo={returnTo}
            onDirtyChange={setDirty}
            onSaved={() => {
              setDirty(false);
              setEdit(false);
              toast({
                title: "Sessão atualizada",
                description: "Os dados foram salvos com sucesso.",
              });
            }}
          />
        )}
      </Drawer>
      {canEdit && (
        <MeetingSheet
          open={meeting}
          onOpenChange={setMeeting}
          sessions={[session]}
          now={now}
          selected={session.id}
        />
      )}
      <Dialog
        open={cancel}
        icon="alert"
        onOpenChange={(open) => {
          if (!pending) setCancel(open);
        }}
        title="Cancelar sessão?"
        description={`As ${session.participant_count} reservas ativas serão canceladas. Os participantes receberão o aviso previsto no sistema; nenhuma nova data será proposta automaticamente.`}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setCancel(false)}>
              Manter sessão
            </Button>
            <Button
              variant="danger"
              loading={pending}
              leadingIcon={<Icon name="trash" size={16} />}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await cancelSessionResultAction(session.id);
                    if (result.ok) {
                      setCancel(false);
                      toast({
                        title: "Sessão cancelada",
                        description: "As reservas foram encerradas.",
                      });
                      router.refresh();
                    } else setError(result.message);
                  } catch {
                    setError("Não foi possível cancelar. Tente novamente.");
                  }
                })
              }
            >
              Confirmar cancelamento
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          {error && <Alert tone="error" title="Cancelamento não concluído" description={error} />}
          <p className={styles.muted}>
            Presenças já registradas impedem o cancelamento. Para remarcar, será necessário criar
            outra sessão.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

/** Confirms a save that arrived through a redirect (`?save=success`). */
export function SaveToast({ show }: { show: boolean }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (!show || shown.current) return;
    shown.current = true;
    toast({ title: "Sessão salva", description: "Os dados foram salvos com sucesso." });
  }, [show, toast]);
  return null;
}
