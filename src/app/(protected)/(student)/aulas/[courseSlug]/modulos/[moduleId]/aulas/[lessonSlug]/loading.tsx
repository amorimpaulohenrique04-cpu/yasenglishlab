import { PageHeader, Skeleton } from "@/components/ui";

export default function LessonLoading() {
  return (
    <div className="yas-learning-page" aria-busy="true" aria-label="Carregando aula">
      <PageHeader title="Carregando aula…" description="Preparando conteúdo e retomada." />
      <Skeleton height="16rem" />
      <Skeleton height="10rem" />
    </div>
  );
}
