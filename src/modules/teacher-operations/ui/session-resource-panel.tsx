"use client";

import { useId, useState } from "react";
import { Button, Drawer, Icon, useToast } from "@/components/ui";
import {
  completeResourceUploadAction,
  resourceUploadAction,
} from "@/app/(protected)/(teacher)/teacher/sessoes/resource-actions";
import { ResourceFileUpload } from "./resource-file-upload";
import { SessionResourceForm } from "./session-resource-form";
import styles from "./sessions.module.css";

/** "Adicionar recurso" sheet: assign a resource/homework or upload a private file. */
export function SessionResourcePanel({
  sessionId,
  choices,
}: {
  sessionId: string;
  choices: {
    materials: { id: string; title: string }[];
    activities: { id: string; title: string }[];
  };
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const toast = useToast();
  return (
    <>
      <Button
        variant="soft"
        size="sm"
        leadingIcon={<Icon name="plus" size={16} />}
        onClick={() => setOpen(true)}
      >
        Adicionar recurso
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        size="lg"
        icon="file"
        title="Adicionar recurso"
        description="Atribua material, prática, link ou tarefa aos participantes desta sessão."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <button type="submit" form={formId} className="yas-button yas-button--secondary">
              <Icon name="check" size={16} />
              <span>Atribuir recurso ou tarefa</span>
            </button>
          </>
        }
      >
        <div className={styles.sheetStack}>
          <SessionResourceForm
            sessionId={sessionId}
            choices={choices}
            formId={formId}
            onSaved={() => {
              setOpen(false);
              toast({
                title: "Recurso atribuído",
                description: "Os participantes já podem acessar.",
              });
            }}
          />
          <section className={styles.uploadSection} aria-labelledby="upload-title">
            <h3 id="upload-title">Ou envie um arquivo</h3>
            <ResourceFileUpload
              sessionId={sessionId}
              upload={resourceUploadAction}
              complete={completeResourceUploadAction}
              onUploaded={() => {
                setOpen(false);
                toast({
                  title: "Arquivo enviado",
                  description: "O arquivo privado foi anexado à sessão.",
                });
              }}
            />
          </section>
        </div>
      </Drawer>
    </>
  );
}
