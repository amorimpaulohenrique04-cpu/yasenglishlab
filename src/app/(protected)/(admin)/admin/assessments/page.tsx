import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { listAdminAssessments } from "@/server/admin-assessments/admin-assessments";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
export default async function AssessmentsPage() {
  const items = await listAdminAssessments();
  return (
    <div className={styles.page}>
      <PageHeader
        title="Teste de entrada e avaliações"
        description="Crie rascunhos, revise os itens e escolha explicitamente a avaliação de entrada."
      />
      <Link className="yas-button yas-button--primary" href="/admin/assessments/new">
        Nova avaliação
      </Link>
      {!items.length && (
        <EmptyState
          title="Nenhuma avaliação"
          description="Crie a primeira avaliação para preparar o teste de entrada."
        />
      )}
      {items.map((item) => (
        <Card key={item.id} className={styles.editorCard}>
          <h2>
            <Link href={`/admin/assessments/${item.id}`}>{item.title}</Link>
          </h2>
          <p>{item.purpose}</p>
          {item.isPlacement && <Badge tone="success">Teste de entrada ativo</Badge>}
          <p>{item.versions.length} versão(ões)</p>
        </Card>
      ))}
    </div>
  );
}
