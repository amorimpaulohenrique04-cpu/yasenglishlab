"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";
import { createResourceResultAction } from "@/app/(protected)/(teacher)/teacher/sessoes/resource-actions";
import styles from "./sessions.module.css";

export function SessionResourceForm({
  sessionId,
  choices,
}: {
  sessionId: string;
  choices: {
    materials: { id: string; title: string }[];
    activities: { id: string; title: string }[];
  };
}) {
  const router = useRouter(),
    ref = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null),
    [pending, startTransition] = useTransition();
  return (
    <form
      ref={ref}
      className={styles.stack}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const result = await createResourceResultAction(form);
            setResult(result);
            if (result.ok) {
              ref.current?.reset();
              router.refresh();
            }
          } catch {
            setResult({
              ok: false,
              message: "Não foi possível atribuir o recurso. Tente novamente.",
            });
          }
        });
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <Select
        name="resource_type"
        label="Tipo de atribuição"
        options={[
          { value: "RESOURCE", label: "Recurso" },
          { value: "HOMEWORK", label: "Tarefa" },
        ]}
      />
      <Input label="Título do recurso" name="title" required maxLength={200} />
      <Textarea label="Instruções" name="instructions" maxLength={4000} />
      <div className={styles.fields}>
        <Input label="Data do prazo (opcional)" type="date" name="due_date" />
        <Input label="Horário do prazo (opcional)" type="time" name="due_time" />
      </div>
      <p className={styles.muted}>Prazo em America/Recife.</p>
      <Select
        label="Material"
        name="material_id"
        options={[
          { value: "", label: "Sem material" },
          ...choices.materials.map((c) => ({ value: c.id, label: c.title })),
        ]}
      />
      <Select
        label="Prática"
        name="practice_activity_id"
        options={[
          { value: "", label: "Sem prática" },
          ...choices.activities.map((c) => ({ value: c.id, label: c.title })),
        ]}
      />
      <Input label="Link HTTPS (opcional)" name="external_url" type="url" maxLength={2048} />
      <p>Selecione apenas uma referência por recurso. É possível atribuir somente instruções.</p>
      {result && (
        <Alert
          tone={result.ok ? "success" : "error"}
          title={result.ok ? "Recurso atribuído" : "Recurso não atribuído"}
          description={result.message}
        />
      )}
      <Button variant="primary" type="submit" loading={pending}>
        Atribuir recurso ou tarefa
      </Button>
    </form>
  );
}
