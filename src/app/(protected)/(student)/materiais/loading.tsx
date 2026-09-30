import { PageHeader, Skeleton } from "@/components/ui";

export default function MaterialsLoading() {
  return (
    <div className="yas-materials-page" aria-busy="true" aria-label="Carregando materiais">
      <PageHeader title="Materiais" description="Preparando seus recursos autorizados." />
      <Skeleton height="6rem" />
      <div className="yas-materials-layout">
        <Skeleton height="24rem" />
        <Skeleton height="18rem" />
      </div>
    </div>
  );
}
