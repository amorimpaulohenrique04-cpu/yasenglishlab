import { PageHeader, Skeleton } from "@/components/ui";
export default function StudentsLoading() {
  return (
    <div className="yas-stack" role="status" aria-label="Carregando alunos">
      <PageHeader title="Alunos" description="Carregando seu acompanhamento pedagógico…" />
      <Skeleton height="7.5rem" />
      <Skeleton height="27.5rem" />
    </div>
  );
}
