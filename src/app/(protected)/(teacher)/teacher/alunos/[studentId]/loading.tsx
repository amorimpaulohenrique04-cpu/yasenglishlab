import { PageHeader, Skeleton } from "@/components/ui";
export default function StudentLoading() {
  return (
    <div className="yas-stack" role="status" aria-label="Carregando perfil pedagógico">
      <PageHeader
        title="Perfil pedagógico"
        description="Carregando registros autorizados do aluno…"
      />
      <Skeleton height="9.375rem" />
      <Skeleton height="22.5rem" />
    </div>
  );
}
