import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import {
  adminContentLabel,
  isAdminContentKind,
  type AdminContentKind,
} from "@/modules/admin-content";
import { ContentEditor, type ParentChoices } from "@/modules/admin-content/ui/content-editor";
import { adminContentErrorCopy } from "@/modules/admin-content/ui/error-copy";
import { loadAdminContent, loadAdminContentItem } from "@/server/admin-content/admin-content";

import { saveContentAction, transitionContentAction } from "../actions";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
import { VideoUpload } from "@/modules/admin-content/ui/video-upload";
import { createVideoUploadAction } from "../video-actions";
import { getAdminVideoStatus } from "@/server/admin-content/video-status";

interface ContentItemPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContentItemPage({ params, searchParams }: ContentItemPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedKind = first(query.kind);
  if (!isAdminContentKind(requestedKind)) notFound();
  const kind: AdminContentKind = requestedKind;
  const record = await loadAdminContentItem(kind, id);
  if (!record) notFound();
  const video =
    kind === "lesson_assets" && record.asset_type === "VIDEO"
      ? await getAdminVideoStatus(id)
      : null;

  if (record.publication_status === "PUBLISHED") {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href={`/admin/content?kind=${kind}`}>
          ← Voltar para {kind}
        </Link>
        {adminContentErrorCopy(first(query.error)) && (
          <Alert
            tone="error"
            title="Não foi possível salvar"
            description="Retire a publicação antes de editar este conteúdo."
          />
        )}
        <PageHeader
          title={String(record.title ?? record.slug ?? "Conteúdo publicado")}
          description="Conteúdo publicado é somente leitura. Retire a publicação para editar com segurança."
          actions={<Badge tone="success">Publicado</Badge>}
        />
        <Card className={styles.itemCard}>
          <p className={styles.itemMeta}>
            A publicação fica visível conforme a disponibilidade, inscrição e permissões do
            conteúdo.
          </p>
          <div className={styles.itemActions}>
            <Link href={`/admin/content/${id}/preview?kind=${kind}`}>
              <Button variant="outline">Pré-visualizar</Button>
            </Link>
            <form action={transitionContentAction}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="DRAFT" />
              <Button
                type="submit"
                variant="secondary"
                aria-label={`Retirar publicação de ${String(record.title ?? record.slug ?? adminContentLabel(kind))}`}
              >
                Retirar publicação
              </Button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  const choices: ParentChoices = {};
  if (kind === "modules") choices.courses = await loadAdminContent("courses");
  if (kind === "lessons") choices.modules = await loadAdminContent("modules");
  if (kind === "lesson_assets") choices.lessons = await loadAdminContent("lessons");
  if (kind === "materials" || kind === "practice_activities") {
    [choices.modules, choices.lessons] = await Promise.all([
      loadAdminContent("modules"),
      loadAdminContent("lessons"),
    ]);
  }
  return (
    <>
      {adminContentErrorCopy(first(query.error)) && (
        <Alert
          tone="error"
          title="Não foi possível salvar"
          description={adminContentErrorCopy(first(query.error))!}
        />
      )}
      <ContentEditor kind={kind} record={record} choices={choices} action={saveContentAction} />
      {video && (
        <Card>
          <h2>Vídeo gravado</h2>
          <p>
            Estado: {video.processing_status} · Legendas: {video.caption_status}
          </p>
          {(video.processing_status === "AWAITING_UPLOAD" ||
            video.processing_status === "ERRORED") && (
            <VideoUpload id={id} action={createVideoUploadAction} />
          )}
          {video.last_provider_error && <p>O provider não conseguiu processar este vídeo.</p>}
          <Link href={`/admin/content/${id}?kind=${kind}`}>Atualizar estado</Link>
        </Card>
      )}
    </>
  );
}
