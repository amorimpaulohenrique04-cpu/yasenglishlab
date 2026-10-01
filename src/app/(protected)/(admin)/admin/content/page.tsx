import Link from "next/link";

import { Alert, Badge, Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import {
  ADMIN_CONTENT_KINDS,
  adminContentLabel,
  adminContentTitle,
  isAdminContentKind,
  recordTitle,
  type AdminContentKind,
  type AdminContentRecord,
} from "@/modules/admin-content";
import { loadAdminContent } from "@/server/admin-content/admin-content";
import { adminContentErrorCopy } from "@/modules/admin-content/ui/error-copy";

import { reorderContentAction, transitionContentAction } from "./actions";
import styles from "@/modules/admin-content/ui/admin-content.module.css";

interface ContentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function orderValue(record: AdminContentRecord): number {
  return typeof record.position === "number" ? record.position : Number(record.position ?? 0);
}

function parentField(kind: AdminContentKind): "course_id" | "module_id" | "lesson_id" | null {
  if (kind === "modules") return "course_id";
  if (kind === "lessons") return "module_id";
  if (kind === "lesson_assets") return "lesson_id";
  return null;
}

function statusText(record: AdminContentRecord): string {
  return record.publication_status === "PUBLISHED" ? "Publicado" : "Rascunho";
}

function statusTone(record: AdminContentRecord): "success" | "neutral" {
  return record.publication_status === "PUBLISHED" ? "success" : "neutral";
}

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
  const query = await searchParams;
  const requestedKind = first(query.kind);
  const kind: AdminContentKind = isAdminContentKind(requestedKind) ? requestedKind : "courses";
  const records = await loadAdminContent(kind);
  const parentKey = parentField(kind);
  const parentRecords = parentKey
    ? await loadAdminContent(
        parentKey === "course_id" ? "courses" : parentKey === "module_id" ? "modules" : "lessons",
      )
    : [];
  const parentTitles = new Map(parentRecords.map((record) => [record.id, recordTitle(record)]));
  const groups = new Map<string, AdminContentRecord[]>();

  for (const record of [...records].sort(
    (a, b) =>
      orderValue(a) - orderValue(b) || recordTitle(a).localeCompare(recordTitle(b), "pt-BR"),
  )) {
    const parentId =
      parentKey && typeof record[parentKey] === "string" ? String(record[parentKey]) : "";
    const key = parentKey ? parentId || "__missing__" : "__all__";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Administração de conteúdo"
        description="Edite rascunhos, visualize o resultado e publique conteúdo validado para os alunos."
      />

      {first(query.saved) === "1" && (
        <Alert tone="success" title="Conteúdo salvo" description="O conteúdo foi atualizado." />
      )}
      {first(query.published) === "1" && (
        <Alert
          tone="success"
          title="Conteúdo publicado"
          description="O conteúdo passou pela validação e está publicado."
        />
      )}
      {first(query.unpublished) === "1" && (
        <Alert
          tone="success"
          title="Publicação retirada"
          description="O conteúdo voltou ao estado de rascunho."
        />
      )}
      {first(query.reordered) === "1" && (
        <Alert tone="success" title="Ordem atualizada" description="A nova ordem foi salva." />
      )}
      {adminContentErrorCopy(first(query.error)) && (
        <Alert
          tone="error"
          title="Não foi possível concluir a operação"
          description={adminContentErrorCopy(first(query.error))!}
        />
      )}

      <nav className={styles.kindNav} aria-label="Tipos de conteúdo">
        {ADMIN_CONTENT_KINDS.map((item) => (
          <Link
            key={item}
            className={kind === item ? styles.kindLinkActive : styles.kindLink}
            href={`/admin/content?kind=${item}`}
            aria-current={kind === item ? "page" : undefined}
          >
            {adminContentTitle(item)}
          </Link>
        ))}
      </nav>

      <SectionHeader
        title={adminContentTitle(kind)}
        actions={
          <Link href={`/admin/content/new?kind=${kind}`}>
            <Button variant="primary">Novo {adminContentLabel(kind)}</Button>
          </Link>
        }
      />

      {records.length === 0 ? (
        <EmptyState
          title={`Nenhum ${adminContentLabel(kind)} cadastrado`}
          description="Crie um rascunho para começar a organizar este conteúdo."
        />
      ) : (
        <div className={styles.list}>
          {[...groups.entries()].map(([groupId, group]) => {
            const groupParentId = parentKey ? groupId : "";
            const groupTitle = parentKey
              ? (parentTitles.get(groupId) ?? "Relação pendente")
              : "Todos os itens";
            return (
              <section
                key={groupId}
                className={styles.group}
                aria-labelledby={parentKey ? `group-${groupId}` : undefined}
                aria-label={parentKey ? undefined : "Lista de conteúdos"}
              >
                {parentKey && (
                  <h2 className={styles.groupTitle} id={`group-${groupId}`}>
                    {groupTitle}
                  </h2>
                )}
                {group.map((record, index) => {
                  const title = recordTitle(record);
                  const siblings = group;
                  const movedUp = [...siblings];
                  if (index > 0)
                    [movedUp[index - 1], movedUp[index]] = [movedUp[index]!, movedUp[index - 1]!];
                  const movedDown = [...siblings];
                  if (index < siblings.length - 1)
                    [movedDown[index], movedDown[index + 1]] = [
                      movedDown[index + 1]!,
                      movedDown[index]!,
                    ];
                  const editHref = `/admin/content/${record.id}?kind=${kind}`;
                  const previewHref = `/admin/content/${record.id}/preview?kind=${kind}`;
                  return (
                    <Card
                      key={record.id}
                      className={styles.itemCard}
                      aria-labelledby={`content-${record.id}`}
                    >
                      <div className={styles.itemTopline}>
                        <h3 className={styles.itemTitle} id={`content-${record.id}`}>
                          {title}
                        </h3>
                        <Badge tone={statusTone(record)}>{statusText(record)}</Badge>
                      </div>
                      <p className={styles.itemMeta}>
                        {typeof record.position === "number" || typeof record.position === "string"
                          ? `Ordem ${record.position}`
                          : ""}
                        {typeof record.active === "boolean"
                          ? `${typeof record.position === "number" || typeof record.position === "string" ? " · " : ""}${record.active ? "Disponibilidade operacional ativa" : "Indisponível para alunos"}`
                          : ""}
                        {record.has_storage_reference
                          ? `${typeof record.position === "number" || typeof record.position === "string" || typeof record.active === "boolean" ? " · " : ""}Arquivo privado vinculado`
                          : ""}
                      </p>
                      <div className={styles.itemActions}>
                        {record.publication_status === "DRAFT" && (
                          <Link href={editHref}>
                            <Button size="sm" variant="outline" aria-label={`Editar ${title}`}>
                              Editar rascunho
                            </Button>
                          </Link>
                        )}
                        <Link href={previewHref}>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Pré-visualizar ${title}`}
                          >
                            Pré-visualizar
                          </Button>
                        </Link>
                        <form action={transitionContentAction}>
                          <input type="hidden" name="kind" value={kind} />
                          <input type="hidden" name="id" value={record.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={
                              record.publication_status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
                            }
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              record.publication_status === "PUBLISHED" ? "secondary" : "primary"
                            }
                            aria-label={
                              record.publication_status === "PUBLISHED"
                                ? `Retirar publicação de ${title}`
                                : `Publicar ${title}`
                            }
                          >
                            {record.publication_status === "PUBLISHED"
                              ? "Retirar publicação"
                              : "Publicar"}
                          </Button>
                        </form>
                        {parentKey && siblings.length > 1 && (
                          <>
                            <form action={reorderContentAction}>
                              <input type="hidden" name="kind" value={kind} />
                              <input type="hidden" name="parent_id" value={groupParentId} />
                              {movedUp.map((item) => (
                                <input key={item.id} type="hidden" name="ids" value={item.id} />
                              ))}
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={index === 0}
                                aria-label={`Mover ${title} para cima`}
                              >
                                ↑
                              </Button>
                            </form>
                            <form action={reorderContentAction}>
                              <input type="hidden" name="kind" value={kind} />
                              <input type="hidden" name="parent_id" value={groupParentId} />
                              {movedDown.map((item) => (
                                <input key={item.id} type="hidden" name="ids" value={item.id} />
                              ))}
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={index === siblings.length - 1}
                                aria-label={`Mover ${title} para baixo`}
                              >
                                ↓
                              </Button>
                            </form>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
