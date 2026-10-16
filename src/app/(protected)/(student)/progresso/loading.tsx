import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function ProgressLoading() {
  return (
    <div className="yas-progress-page" aria-busy="true" aria-label="Carregando progresso">
      <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
      <div className="yas-progress-top">
        <Card>
          <Skeleton width="12rem" />
          <Skeleton height="12rem" style={{ marginTop: "1rem" }} />
        </Card>
        <Card>
          <Skeleton width="9rem" />
          <Skeleton height="12rem" style={{ marginTop: "1rem" }} />
        </Card>
      </div>
      <Card>
        <Skeleton width="12rem" />
        <Skeleton height="6rem" style={{ marginTop: "1rem" }} />
      </Card>
    </div>
  );
}
