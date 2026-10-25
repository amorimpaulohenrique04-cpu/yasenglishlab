import Link from "next/link";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { listAdminAssessments } from "@/server/admin-assessments/admin-assessments";
import styles from "@/modules/admin-content/ui/admin-content.module.css";

const versionStatus = {
  DRAFT: { label: "Rascunho", tone: "warning" },
  PUBLISHED: { label: "Publicada", tone: "success" },
  RETIRED: { label: "Aposentada", tone: "neutral" },
} as const;
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Recife",
});

export default async function AssessmentsPage() {
  const items = await listAdminAssessments();
  const rows = items.map((item) => {
    const latest = [...item.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const status = latest ? versionStatus[latest.status] : undefined;
    const published = latest?.publishedAt ? dateFormat.format(new Date(latest.publishedAt)) : "—";
    const badges = (
      <span className={styles.badgeRow}>
        {status && (
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        )}
        {item.isPlacement && <Badge tone="success">Teste de entrada ativo</Badge>}
      </span>
    );
    const open = (
      <Link
        className="yas-button yas-button--outline yas-button--sm"
        href={`/admin/assessments/${item.id}`}
        aria-label={`Abrir ${item.title}`}
      >
        Abrir
      </Link>
    );
    const questions = latest
      ? `${latest.itemCount} ${latest.itemCount === 1 ? "questão" : "questões"}`
      : "—";
    return {
      id: item.id,
      cells: [
        <span key="title" className={styles.assessmentTitle}>
          <Link href={`/admin/assessments/${item.id}`}>{item.title}</Link>
          <small>{item.purpose}</small>
        </span>,
        badges,
        questions,
        `${item.versions.length} ${item.versions.length === 1 ? "versão" : "versões"}`,
        published,
        <span key="open" className={styles.cellEnd}>
          {open}
        </span>,
      ],
      mobile: (
        <article className={styles.assessmentCard}>
          <span className={styles.assessmentTitle}>
            <Link href={`/admin/assessments/${item.id}`}>{item.title}</Link>
            <small>{item.purpose}</small>
          </span>
          {badges}
          <p className={styles.assessmentMeta}>
            {questions} · {item.versions.length} {item.versions.length === 1 ? "versão" : "versões"}{" "}
            · Publicada em {published}
          </p>
          {open}
        </article>
      ),
    };
  });
  return (
    <div className={styles.page}>
      <PageHeader
        title="Teste de entrada e avaliações"
        description="Crie rascunhos, revise os itens e escolha explicitamente a avaliação de entrada."
        actions={
          <Link className="yas-button yas-button--primary" href="/admin/assessments/new">
            Nova avaliação
          </Link>
        }
      />
      {rows.length ? (
        <DataTable
          caption="Avaliações cadastradas"
          columns={[
            { id: "title", label: "Avaliação" },
            { id: "status", label: "Estado" },
            { id: "questions", label: "Questões" },
            { id: "versions", label: "Versões" },
            { id: "published", label: "Publicada em" },
            { id: "action", label: "Ação", align: "end" },
          ]}
          rows={rows}
        />
      ) : (
        <EmptyState
          title="Nenhuma avaliação"
          description="Crie a primeira avaliação para preparar o teste de entrada."
        />
      )}
    </div>
  );
}
