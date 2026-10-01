import { PageHeader, Skeleton } from "@/components/ui";

export default function PracticeLoading() {
  return (
    <div className="yas-practice-page" aria-busy="true" aria-label="Carregando práticas">
      <PageHeader title="Prática" description="Preparando sua próxima atividade." />
      <div className="yas-practice-top-grid">
        <Skeleton height="14rem" />
        <Skeleton height="14rem" />
      </div>
      <Skeleton height="7rem" />
      <Skeleton height="18rem" />
    </div>
  );
}
