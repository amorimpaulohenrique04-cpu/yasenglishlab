import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, PageHeader } from "@/components/ui";
import {
  adminContentLabel,
  isAdminContentKind,
  type AdminContentKind,
  type AdminContentRecord,
} from "@/modules/admin-content";
import { loadAdminContentItem } from "@/server/admin-content/admin-content";

import styles from "@/modules/admin-content/ui/admin-content.module.css";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function textField(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if (typeof row.text === "string") return row.text;
    if (typeof row.prompt === "string") return row.prompt;
    if (typeof row.instructions === "string") return row.instructions;
  }
  return null;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function PracticePreview({ record }: { record: AdminContentRecord }) {
  const content = record.content as Record<string, unknown> | null;
  if (!content || typeof content !== "object")
    return <p>O formato desta atividade ainda não está disponível para pré-visualização.</p>;
  return (
    <div className={styles.previewBody}>
      <h2>{String(content.prompt ?? "Atividade")}</h2>
      {content.kind === "MULTIPLE_CHOICE" && Array.isArray(content.options) ? (
        <ol className={styles.previewOptions}>
          {content.options.map((option, index) => {
            const row =
              option && typeof option === "object" ? (option as Record<string, unknown>) : {};
            return <li key={String(row.id ?? index)}>{String(row.label ?? "")}</li>;
          })}
        </ol>
      ) : (
        <p>{String(content.instructions ?? "Resposta em texto livre, sem correção automática.")}</p>
      )}
    </div>
  );
}

function PreviewBody({ kind, record }: { kind: AdminContentKind; record: AdminContentRecord }) {
  if (kind === "practice_activities") return <PracticePreview record={record} />;
  if (kind === "lesson_assets") {
    const type = String(record.asset_type ?? "");
    const sourceUrl = safeHttpUrl(record.source_url);
    if (type === "LINK" && sourceUrl)
      return (
        <p>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Abrir conteúdo vinculado
          </a>
        </p>
      );
    if (
      type === "TEXT" &&
      record.content &&
      typeof record.content === "object" &&
      !Array.isArray(record.content)
    ) {
      const content = record.content as Record<string, unknown>;
      return (
        <div className={styles.previewBody}>
          {typeof content.title === "string" && <h2>{content.title}</h2>}
          {typeof content.body === "string" && <p>{content.body}</p>}
        </div>
      );
    }
    const text = textField(record.content);
    if (text !== null) return <div className={styles.previewBody}>{text}</div>;
    if (record.has_storage_reference)
      return (
        <p>Arquivo privado cadastrado. O arquivo não é exibido neste preview administrativo.</p>
      );
    if (sourceUrl)
      return (
        <p>
          Conteúdo externo:{" "}
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            abrir em nova guia
          </a>
        </p>
      );
    return <p>O conteúdo deste tipo de asset não possui uma visualização textual.</p>;
  }
  if (kind === "materials") {
    const externalUrl = safeHttpUrl(record.external_url);
    if (externalUrl)
      return (
        <p>
          <a href={externalUrl} target="_blank" rel="noreferrer">
            Abrir recurso em nova guia
          </a>
        </p>
      );
    if (record.has_storage_reference)
      return <p>Arquivo privado cadastrado. O caminho interno permanece oculto.</p>;
    return <p>Este material ainda não tem um recurso disponível para abrir.</p>;
  }
  const description = textField(record.description);
  return <p>{description ?? `Pré-visualização do ${adminContentLabel(kind)}.`}</p>;
}

export default async function AdminContentPreviewPage({ params, searchParams }: PreviewPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const kind = first(query.kind);
  if (!isAdminContentKind(kind)) notFound();
  const record = await loadAdminContentItem(kind, id);
  if (!record) notFound();
  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href={`/admin/content?kind=${kind}`}>
        ← Voltar para {kind}
      </Link>
      <PageHeader
        title={`Pré-visualização do ${adminContentLabel(kind)}`}
        description={String(record.title ?? record.slug ?? "Conteúdo")}
        actions={
          <Badge tone={record.publication_status === "PUBLISHED" ? "success" : "neutral"}>
            {record.publication_status === "PUBLISHED" ? "Publicado" : "Rascunho"}
          </Badge>
        }
      />
      <div className={styles.split}>
        <Card className={styles.itemCard}>
          <h2 className={styles.itemTitle}>{String(record.title ?? record.slug ?? "Conteúdo")}</h2>
          <PreviewBody kind={kind} record={record} />
        </Card>
        <Card className={styles.itemCard}>
          <h2 className={styles.itemTitle}>Visibilidade</h2>
          <p className={styles.itemMeta}>
            Este preview é privado e não altera a publicação. A área do aluno depende do estado
            publicado e dos requisitos de disponibilidade e acesso.
          </p>
          {record.has_storage_reference && (
            <p className={styles.notice}>
              Há um arquivo privado vinculado. Nenhum caminho de armazenamento é mostrado.
            </p>
          )}
          <Link
            href={
              record.publication_status === "DRAFT"
                ? `/admin/content/${id}?kind=${kind}`
                : `/admin/content?kind=${kind}`
            }
          >
            {record.publication_status === "DRAFT" ? "Editar rascunho" : "Voltar à lista"}
          </Link>
        </Card>
      </div>
    </div>
  );
}
