import { PageHeader, Skeleton } from "@/components/ui";

export default function StudentLearningLoading() {
  return (
    <div className="yas-learning-page" aria-busy="true" aria-label="Carregando conteúdo">
      <PageHeader title="Carregando…" description="Preparando sua trilha de aprendizagem." />
      <Skeleton height="11rem" />
      <Skeleton height="8rem" />
    </div>
  );
}
