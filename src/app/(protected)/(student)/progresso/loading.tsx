import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function ProgressLoading() {
  return (
    <div className="yas-progress-page" aria-busy="true" aria-label="Carregando progresso">
      <PageHeader title="Progresso" description="Entenda como sua jornada está avançando." />
      <div className="yas-progress-overview">
        {[0, 1].map((item) => (
          <Card key={item}>
            <div className="yas-progress-card-stack">
              <Skeleton width="7rem" />
              <Skeleton width="70%" height="2rem" />
              <Skeleton height="4rem" />
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="yas-progress-card-stack">
          <Skeleton width="12rem" />
          <Skeleton height="10rem" />
        </div>
      </Card>
    </div>
  );
}
