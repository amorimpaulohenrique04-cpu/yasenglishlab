"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  DateField,
  Icon,
  Input,
  Select,
  Textarea,
  TimeField,
  type IconName,
} from "@/components/ui";
import { createResourceResultAction } from "@/app/(protected)/(teacher)/teacher/sessoes/resource-actions";
import styles from "./sessions.module.css";

type Reference = "none" | "material" | "practice" | "link";

const references: { id: Reference; label: string; icon: IconName }[] = [
  { id: "none", label: "Só instruções", icon: "pen" },
  { id: "material", label: "Material", icon: "book" },
  { id: "practice", label: "Prática", icon: "target" },
  { id: "link", label: "Link", icon: "link" },
];

/** Assigns a resource or homework; only the chosen reference is sent, as the server requires. */
export function SessionResourceForm({
  sessionId,
  choices,
  formId,
  onSaved,
}: {
  sessionId: string;
  choices: {
    materials: { id: string; title: string }[];
    activities: { id: string; title: string }[];
  };
  formId?: string;
  onSaved?: () => void;
}) {
  const router = useRouter(),
    ref = useRef<HTMLFormElement>(null),
    generatedId = useId();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null),
    [kind, setKind] = useState<"RESOURCE" | "HOMEWORK">("RESOURCE"),
    [reference, setReference] = useState<Reference>("none"),
    [dueDate, setDueDate] = useState(""),
    [dueTime, setDueTime] = useState(""),
    [pending, startTransition] = useTransition();
  return (
    <form
      id={formId ?? generatedId}
      ref={ref}
      className={styles.sheetForm}
      aria-busy={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const response = await createResourceResultAction(form);
            setResult(response);
            if (response.ok) {
              ref.current?.reset();
              setReference("none");
              setDueDate("");
              setDueTime("");
              setKind("RESOURCE");
              router.refresh();
              onSaved?.();
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
      <fieldset className={styles.choiceCards}>
        <legend>Tipo de atribuição</legend>
        {(
          [
            ["RESOURCE", "Recurso", "Material de apoio para a aula", "file"],
            ["HOMEWORK", "Tarefa", "Atividade com prazo para o aluno", "check-c"],
          ] as const
        ).map(([value, label, hint, icon]) => (
          <label
            key={value}
            className={styles.choiceCard}
            data-checked={kind === value || undefined}
          >
            <input
              type="radio"
              name="resource_type"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            <span className={styles.choiceIcon} aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <Input label="Título do recurso" name="title" required maxLength={200} />
      <Textarea label="Instruções" name="instructions" maxLength={4000} rows={3} />
      <div className={styles.fieldRow}>
        <DateField
          label="Data do prazo (opcional)"
          name="due_date"
          value={dueDate}
          onChange={setDueDate}
        />
        <TimeField
          label="Horário do prazo (opcional)"
          name="due_time"
          value={dueTime}
          onChange={setDueTime}
        />
      </div>
      <p className={styles.fieldHint}>Prazo em America/Recife. Informe data e horário juntos.</p>
      <fieldset className={styles.segmentedField}>
        <legend>Referência</legend>
        <div className={styles.segmentedOptions}>
          {references.map((option) => (
            <label key={option.id} data-checked={reference === option.id || undefined}>
              <input
                type="radio"
                name="reference_kind"
                value={option.id}
                checked={reference === option.id}
                onChange={() => setReference(option.id)}
              />
              <Icon name={option.icon} size={15} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {reference === "material" && (
        <Select
          label="Material"
          name="material_id"
          required
          options={[
            { value: "", label: "Selecione um material" },
            ...choices.materials.map((c) => ({ value: c.id, label: c.title })),
          ]}
        />
      )}
      {reference === "practice" && (
        <Select
          label="Prática"
          name="practice_activity_id"
          required
          options={[
            { value: "", label: "Selecione uma prática" },
            ...choices.activities.map((c) => ({ value: c.id, label: c.title })),
          ]}
        />
      )}
      {reference === "link" && (
        <Input label="Link HTTPS" name="external_url" type="url" required maxLength={2048} />
      )}
      {result && (
        <Alert
          tone={result.ok ? "success" : "error"}
          title={result.ok ? "Recurso atribuído" : "Recurso não atribuído"}
          description={result.message}
        />
      )}
      {!formId && (
        <button type="submit" className="yas-button yas-button--secondary" disabled={pending}>
          Atribuir recurso ou tarefa
        </button>
      )}
    </form>
  );
}
