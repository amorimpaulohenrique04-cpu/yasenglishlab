import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, Badge, Button, Card, Checkbox, PageHeader } from "@/components/ui";
import { AssessmentEditor } from "@/modules/admin-assessments/ui/assessment-editor";
import { getAdminAssessment } from "@/server/admin-assessments/admin-assessments";
import { changeAssessmentAction, saveAssessmentAction } from "../actions";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const versionId = typeof query.version === "string" ? query.version : undefined;
  if (versionId && !z.uuid().safeParse(versionId).success) notFound();
  const detail = await getAdminAssessment(id, versionId);
  const version = detail.version;
  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/admin/assessments">
        ← Voltar para avaliações
      </Link>
      <PageHeader title={detail.title} description={detail.purpose} />
      {query.saved && <Alert tone="success" title="Rascunho salvo" />}
      {query.changed && <Alert tone="success" title="Avaliação atualizada" />}
      {query.error && (
        <Alert
          tone="error"
          title="Não foi possível concluir"
          description={
            query.error === "retire"
              ? "O teste de entrada precisa manter uma versão publicada. Publique uma substituta antes de aposentar."
              : "Confira os enunciados, alternativas, gabaritos e o estado da versão. Tente novamente."
          }
        />
      )}
      {detail.isPlacement && <Badge tone="success">Teste de entrada ativo</Badge>}
      <nav className={styles.kindNav} aria-label="Versões da avaliação">
        {detail.versions.map((v) => (
          <Link
            key={v.id}
            className={styles.kindLink}
            href={`/admin/assessments/${id}?version=${v.id}`}
          >
            Versão {v.versionNumber} ·{" "}
            {v.status === "DRAFT"
              ? "Rascunho"
              : v.status === "PUBLISHED"
                ? "Publicada"
                : "Aposentada"}
          </Link>
        ))}
      </nav>
      {version && (
        <Card className={styles.editorCard}>
          <h2>Publicação da versão {version.versionNumber}</h2>
          {version.status === "DRAFT" && (
            <form action={changeAssessmentAction} className={styles.editorForm}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="versionId" value={version.id} />
              <input type="hidden" name="command" value="publish" />
              <Checkbox
                name="makePlacement"
                label="Usar como teste de entrada"
                defaultChecked={detail.isPlacement}
              />
              <p>
                Esta escolha substitui a avaliação de entrada anterior após uma publicação válida.
              </p>
              <Button type="submit">Publicar avaliação</Button>
            </form>
          )}
          {version.status !== "DRAFT" && (
            <form action={changeAssessmentAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="command" value="new_version" />
              <Button type="submit">Criar nova versão</Button>
            </form>
          )}
          {version.status === "PUBLISHED" && (
            <form action={changeAssessmentAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="versionId" value={version.id} />
              <input type="hidden" name="command" value="retire" />
              <Button variant="secondary" type="submit">
                Aposentar versão
              </Button>
            </form>
          )}
        </Card>
      )}
      <AssessmentEditor key={version?.id} detail={detail} action={saveAssessmentAction} />
    </div>
  );
}
