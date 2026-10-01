import Link from "next/link";

import { Button, Card, Checkbox, PageHeader, Select, Textarea, Input } from "@/components/ui";
import {
  ADMIN_CONTENT_KINDS,
  adminContentLabel,
  type AdminContentKind,
  type AdminContentRecord,
} from "@/modules/admin-content";

import styles from "./admin-content.module.css";

export type ParentChoices = Partial<
  Record<"courses" | "modules" | "lessons", AdminContentRecord[]>
>;

const assetTypes = ["TEXT", "LINK", "VIDEO", "AUDIO", "PDF", "EXERCISE"];
const materialTypes = [
  "PDF",
  "SUMMARY",
  "VOCABULARY",
  "GRAMMAR",
  "AUDIO",
  "WORKSHEET",
  "ANSWER_KEY",
];
const skills = ["SPEAKING", "LISTENING", "PRONUNCIATION", "VOCABULARY", "GRAMMAR"];
const cefr = ["A1", "A2", "B1", "B2", "C1", "C2"];

function value(record: AdminContentRecord | null, key: string, fallback = ""): string {
  const raw = record?.[key];
  return raw === null || raw === undefined ? fallback : String(raw);
}

function jsonValue(record: AdminContentRecord | null, key: string, fallback: unknown): string {
  const raw = record?.[key];
  return JSON.stringify(raw === null || raw === undefined ? fallback : raw, null, 2);
}

function options(records: AdminContentRecord[] | undefined) {
  return (records ?? []).map((record) => ({
    value: record.id,
    label: String(record.title ?? record.slug ?? record.id),
  }));
}

function ParentSelect({
  label,
  name,
  records,
  current,
  required = true,
}: {
  label: string;
  name: string;
  records?: AdminContentRecord[] | undefined;
  current: string;
  required?: boolean;
}) {
  return (
    <Select
      label={label}
      name={name}
      defaultValue={current}
      options={[{ value: "", label: "Selecione…" }, ...options(records)]}
      required={required}
    />
  );
}

export function ContentEditor({
  kind,
  record,
  choices,
  action,
}: {
  kind: AdminContentKind;
  record: AdminContentRecord | null;
  choices: ParentChoices;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const label = adminContentLabel(kind);
  const isNew = record === null;
  const active = record?.active === true;
  const saveLabel = isNew ? `Criar ${label} como rascunho` : "Salvar rascunho";

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href={`/admin/content?kind=${kind}`}>
        ← Voltar para {kind}
      </Link>
      <PageHeader
        title={isNew ? `Novo ${label}` : `Editar ${label}`}
        description="Rascunhos não são exibidos aos alunos. A publicação é validada pelo sistema."
      />
      <Card className={styles.editorCard}>
        <form action={action} className={styles.editorForm}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={record?.id ?? ""} />

          {kind === "courses" && (
            <>
              <Input
                label="Título"
                name="title"
                defaultValue={value(record, "title")}
                required
                maxLength={160}
              />
              <Input
                label="Slug"
                name="slug"
                defaultValue={value(record, "slug")}
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
              <Textarea
                label="Descrição"
                name="description"
                defaultValue={value(record, "description")}
                rows={4}
                maxLength={4000}
              />
              <Checkbox
                name="active"
                value="true"
                defaultChecked={active}
                label="Disponível para alunos após publicação"
              />
            </>
          )}

          {kind === "modules" && (
            <>
              <ParentSelect
                label="Curso"
                name="course_id"
                records={choices.courses}
                current={value(record, "course_id")}
              />
              <Input
                label="Ordem"
                name="position"
                type="number"
                min={1}
                defaultValue={value(record, "position", "1")}
                required
              />
              <Input
                label="Título"
                name="title"
                defaultValue={value(record, "title")}
                required
                maxLength={160}
              />
              <Textarea
                label="Descrição"
                name="description"
                defaultValue={value(record, "description")}
                rows={4}
                maxLength={4000}
              />
            </>
          )}

          {kind === "lessons" && (
            <>
              <ParentSelect
                label="Módulo"
                name="module_id"
                records={choices.modules}
                current={value(record, "module_id")}
              />
              <Input
                label="Ordem"
                name="position"
                type="number"
                min={1}
                defaultValue={value(record, "position", "1")}
                required
              />
              <Input
                label="Título"
                name="title"
                defaultValue={value(record, "title")}
                required
                maxLength={160}
              />
              <Input
                label="Slug"
                name="slug"
                defaultValue={value(record, "slug")}
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
              <Input
                label="Duração estimada (minutos)"
                name="estimated_minutes"
                type="number"
                min={1}
                defaultValue={value(record, "estimated_minutes")}
              />
            </>
          )}

          {kind === "lesson_assets" && (
            <>
              <ParentSelect
                label="Aula"
                name="lesson_id"
                records={choices.lessons}
                current={value(record, "lesson_id")}
              />
              <Select
                label="Tipo de conteúdo"
                name="asset_type"
                defaultValue={value(record, "asset_type", "TEXT")}
                options={assetTypes.map((type) => ({ value: type, label: type }))}
                required
              />
              <Input
                label="Ordem"
                name="position"
                type="number"
                min={1}
                defaultValue={value(record, "position", "1")}
                required
              />
              <Input
                label="URL de origem"
                name="source_url"
                type="url"
                defaultValue={value(record, "source_url")}
              />
              <Textarea
                label="Conteúdo (JSON)"
                name="content_json"
                defaultValue={jsonValue(record, "content", { title: "", body: "" })}
                rows={8}
              />
              <Input
                label="Entitlement necessário (opcional)"
                name="required_entitlement_key"
                defaultValue={value(record, "required_entitlement_key")}
                maxLength={64}
              />
              <Textarea
                label="Metadados (JSON)"
                name="metadata_json"
                defaultValue={jsonValue(record, "metadata", {})}
                rows={4}
              />
              {record?.has_storage_reference && (
                <p className={styles.notice}>
                  Este conteúdo usa um arquivo privado. O caminho interno não é exibido nem editável
                  nesta tela.
                </p>
              )}
            </>
          )}

          {kind === "materials" && (
            <>
              <Input
                label="Título"
                name="title"
                defaultValue={value(record, "title")}
                required
                maxLength={160}
              />
              <Select
                label="Tipo de material"
                name="material_type"
                defaultValue={value(record, "material_type", "SUMMARY")}
                options={materialTypes.map((type) => ({ value: type, label: type }))}
                required
              />
              <ParentSelect
                label="Módulo (opcional)"
                name="module_id"
                records={choices.modules}
                current={value(record, "module_id")}
                required={false}
              />
              <ParentSelect
                label="Aula (opcional)"
                name="lesson_id"
                records={choices.lessons}
                current={value(record, "lesson_id")}
                required={false}
              />
              <Input
                label="URL externa"
                name="external_url"
                type="url"
                defaultValue={value(record, "external_url")}
                required={isNew}
              />
              <Input
                label="Entitlement necessário (opcional)"
                name="required_entitlement_key"
                defaultValue={value(record, "required_entitlement_key")}
                maxLength={64}
              />
              <Textarea
                label="Metadados (JSON)"
                name="metadata_json"
                defaultValue={jsonValue(record, "metadata", {})}
                rows={5}
              />
              <Checkbox
                name="active"
                value="true"
                defaultChecked={active}
                label="Disponível para alunos após publicação"
              />
              {isNew && (
                <p className={styles.notice}>
                  O envio de arquivos privados ainda não está disponível para materiais novos. Use
                  uma URL externa segura; materiais existentes com arquivo privado podem ter os
                  demais metadados editados.
                </p>
              )}
              {record?.has_storage_reference && (
                <p className={styles.notice}>
                  Este material usa um arquivo privado. O caminho interno não é exibido nem editável
                  nesta tela.
                </p>
              )}
            </>
          )}

          {kind === "practice_activities" && (
            <>
              <Input
                label="Título"
                name="title"
                defaultValue={value(record, "title")}
                required
                maxLength={160}
              />
              <Input
                label="Slug"
                name="slug"
                defaultValue={value(record, "slug")}
                required
                maxLength={100}
              />
              <Select
                label="Habilidade"
                name="skill"
                defaultValue={value(record, "skill", "VOCABULARY")}
                options={skills.map((skill) => ({ value: skill, label: skill }))}
                required
              />
              <Select
                label="Nível CEFR (opcional)"
                name="cefr_target"
                defaultValue={value(record, "cefr_target")}
                options={[
                  { value: "", label: "Sem nível definido" },
                  ...cefr.map((level) => ({ value: level, label: level })),
                ]}
              />
              <Input
                label="Dificuldade (opcional)"
                name="difficulty"
                defaultValue={value(record, "difficulty")}
                maxLength={80}
              />
              <Input
                label="Duração estimada (minutos)"
                name="estimated_minutes"
                type="number"
                min={1}
                defaultValue={value(record, "estimated_minutes", "5")}
                required
              />
              <ParentSelect
                label="Módulo relacionado (opcional)"
                name="related_module_id"
                records={choices.modules}
                current={value(record, "related_module_id")}
                required={false}
              />
              <ParentSelect
                label="Aula relacionada (opcional)"
                name="related_lesson_id"
                records={choices.lessons}
                current={value(record, "related_lesson_id")}
                required={false}
              />
              <Textarea
                label="Conteúdo da atividade (JSON)"
                name="content_json"
                defaultValue={jsonValue(record, "content", {
                  kind: "MULTIPLE_CHOICE",
                  evaluationMode: "DETERMINISTIC",
                  prompt: "Type a question for the learner.",
                  options: [
                    { id: "a", label: "Option A" },
                    { id: "b", label: "Option B" },
                  ],
                })}
                rows={10}
                required
              />
              <Textarea
                label="Gabarito privado (JSON)"
                name="answer_key_json"
                defaultValue={record?.answer_key ? jsonValue(record, "answer_key", {}) : ""}
                rows={3}
              />
              <p className={styles.notice}>
                {
                  'Use `{"kind":"MANUAL_TEXT","evaluationMode":"MANUAL_PENDING","prompt":"...","instructions":"..."}` para uma atividade sem correção automática. O gabarito privado nunca aparece no preview.'
                }
              </p>
              <Checkbox
                name="active"
                value="true"
                defaultChecked={active}
                label="Disponível para alunos após publicação"
              />
            </>
          )}

          <div className={styles.actions}>
            <Button type="submit" variant="primary">
              {saveLabel}
            </Button>
            <Link className={styles.secondaryLink} href={`/admin/content?kind=${kind}`}>
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function contentKindsForNavigation() {
  return ADMIN_CONTENT_KINDS;
}
