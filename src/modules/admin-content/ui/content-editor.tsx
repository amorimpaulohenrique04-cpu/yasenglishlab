import Link from "next/link";
import type { ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  ADMIN_CONTENT_KINDS,
  adminContentLabel,
  adminContentTitle,
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
const skills = ["SPEAKING", "PRONUNCIATION", "VOCABULARY", "GRAMMAR"];
const cefr = ["A1", "A2", "B1", "B2", "C1", "C2"];

function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="yas-form-section" aria-labelledby={`content-${id}`}>
      <header>
        <h2 id={`content-${id}`}>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

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

function WelcomeCheckbox({ record }: { record: AdminContentRecord | null }) {
  return (
    <Checkbox
      name="welcome"
      value="true"
      defaultChecked={record?.welcome === true}
      label="Conteúdo inicial: liberado para alunos pagantes enquanto aguardam a turma"
    />
  );
}

function AudienceSelect({ record }: { record: AdminContentRecord | null }) {
  return (
    <Select
      label="Quem vê este conteúdo"
      name="audience"
      defaultValue={value(record, "audience", "COURSE")}
      options={[
        { value: "COURSE", label: "Todas as turmas do curso" },
        { value: "COHORTS", label: "Somente turmas que incluírem na trilha" },
      ]}
    />
  );
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
  const slug = value(record, "slug");
  const position = value(record, "position");

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href={`/admin/content?kind=${kind}`}>
        ← Voltar para {adminContentTitle(kind).toLowerCase()}
      </Link>
      <PageHeader
        title={isNew ? `Novo ${label}` : `Editar ${label}`}
        description="Rascunhos não são exibidos aos alunos. A publicação é validada pelo sistema."
      />
      <form action={action} className="yas-editor-layout">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={record?.id ?? ""} />
        <div className="yas-editor-main">
          {kind === "courses" && (
            <>
              <FormSection
                id="identity"
                title="Identificação"
                description="Nome e endereço do curso."
              >
                <div className="yas-form-grid">
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
                    defaultValue={slug}
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  />
                </div>
                <Textarea
                  label="Descrição"
                  name="description"
                  defaultValue={value(record, "description")}
                  rows={4}
                  maxLength={4000}
                />
              </FormSection>
              <FormSection id="availability" title="Disponibilidade">
                <Checkbox
                  name="active"
                  value="true"
                  defaultChecked={active}
                  label="Disponível para alunos após publicação"
                />
              </FormSection>
            </>
          )}

          {kind === "modules" && (
            <>
              <FormSection
                id="placement"
                title="Posição na trilha"
                description="Em qual curso o módulo fica e em que ordem."
              >
                <div className="yas-form-grid">
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
                </div>
              </FormSection>
              <FormSection id="content" title="Conteúdo">
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
              </FormSection>
              <FormSection id="visibility" title="Visibilidade">
                <AudienceSelect record={record} />
              </FormSection>
            </>
          )}

          {kind === "lessons" && (
            <>
              <FormSection
                id="placement"
                title="Posição no módulo"
                description="Em qual módulo a aula fica e em que ordem."
              >
                <div className="yas-form-grid">
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
                </div>
              </FormSection>
              <FormSection id="content" title="Conteúdo">
                <div className="yas-form-grid">
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
                    defaultValue={slug}
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
                </div>
              </FormSection>
              <FormSection id="visibility" title="Visibilidade">
                <AudienceSelect record={record} />
                <WelcomeCheckbox record={record} />
              </FormSection>
            </>
          )}

          {kind === "lesson_assets" && (
            <>
              <FormSection
                id="placement"
                title="Vínculo"
                description="A aula, o tipo e a ordem do conteúdo."
              >
                <div className="yas-form-grid">
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
                </div>
              </FormSection>
              <FormSection id="content" title="Conteúdo">
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
                {record?.has_storage_reference && (
                  <p className={styles.notice}>
                    Este conteúdo usa um arquivo privado. O caminho interno não é exibido nem
                    editável nesta tela.
                  </p>
                )}
              </FormSection>
              <FormSection id="access" title="Acesso e metadados">
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
              </FormSection>
            </>
          )}

          {kind === "materials" && (
            <>
              <FormSection id="identity" title="Identificação">
                <div className="yas-form-grid">
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
                </div>
              </FormSection>
              <FormSection
                id="resource"
                title="Vínculo e recurso"
                description="Onde o material aparece e onde o aluno o abre."
              >
                <div className="yas-form-grid">
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
                </div>
                <Input
                  label="URL externa"
                  name="external_url"
                  type="url"
                  defaultValue={value(record, "external_url")}
                  required={isNew}
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
                    Este material usa um arquivo privado. O caminho interno não é exibido nem
                    editável nesta tela.
                  </p>
                )}
              </FormSection>
              <FormSection id="access" title="Acesso e visibilidade">
                <Input
                  label="Entitlement necessário (opcional)"
                  name="required_entitlement_key"
                  defaultValue={value(record, "required_entitlement_key")}
                  maxLength={64}
                />
                <AudienceSelect record={record} />
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
                <WelcomeCheckbox record={record} />
              </FormSection>
            </>
          )}

          {kind === "practice_activities" && (
            <>
              <FormSection id="identity" title="Identificação">
                <div className="yas-form-grid">
                  <Input
                    label="Título"
                    name="title"
                    defaultValue={value(record, "title")}
                    required
                    maxLength={160}
                  />
                  <Input label="Slug" name="slug" defaultValue={slug} required maxLength={100} />
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
                </div>
              </FormSection>
              <FormSection
                id="related"
                title="Relacionamento"
                description="Opcional: ligue a prática a um módulo ou aula."
              >
                <div className="yas-form-grid">
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
                </div>
              </FormSection>
              <FormSection id="activity" title="Atividade">
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
              </FormSection>
              <FormSection id="availability" title="Disponibilidade">
                <Checkbox
                  name="active"
                  value="true"
                  defaultChecked={active}
                  label="Disponível para alunos após publicação"
                />
              </FormSection>
            </>
          )}
        </div>

        <aside className="yas-editor-aside" aria-label="Resumo do conteúdo">
          <Card className="yas-editor-summary">
            <h2>Estado</h2>
            <div>
              <Badge tone={isNew ? "info" : "neutral"}>
                {isNew ? "Novo rascunho" : "Rascunho"}
              </Badge>
            </div>
            <ul className="yas-editor-summary-skills" aria-label="Detalhes do conteúdo">
              <li>
                <span>Tipo</span>
                <strong>{label}</strong>
              </li>
              {slug && (
                <li>
                  <span>Endereço</span>
                  <strong>{slug}</strong>
                </li>
              )}
              {position && (
                <li>
                  <span>Posição</span>
                  <strong>{position}</strong>
                </li>
              )}
            </ul>
            <p className="yas-editor-summary-note">
              Salvar mantém o conteúdo como rascunho. A publicação é feita pela lista, depois da
              pré-visualização.
            </p>
            <Button type="submit" variant="primary">
              {saveLabel}
            </Button>
            {record?.id && (
              <Link
                className={styles.secondaryLink}
                href={`/admin/content/${String(record.id)}/preview?kind=${kind}`}
              >
                Pré-visualizar rascunho
              </Link>
            )}
            <Link className={styles.secondaryLink} href={`/admin/content?kind=${kind}`}>
              Cancelar
            </Link>
          </Card>
        </aside>
      </form>
    </div>
  );
}

export function contentKindsForNavigation() {
  return ADMIN_CONTENT_KINDS;
}
