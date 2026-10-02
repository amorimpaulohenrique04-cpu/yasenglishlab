import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function HomeLoading() {
  return (
    <div className="yas-home-page" aria-busy="true" aria-label="Carregando início">
      <PageHeader title="Carregando…" description="Preparando seu próximo passo." />
      <div className="yas-home-overview">
        <Card className="yas-home-card">
          <Skeleton height="12rem" />
        </Card>
        <Card className="yas-home-card">
          <Skeleton height="8rem" />
        </Card>
        <Card className="yas-home-card">
          <Skeleton height="8rem" />
        </Card>
      </div>
      <div className="yas-home-secondary">
        <Card className="yas-home-card">
          <Skeleton height="9rem" />
        </Card>
        <Card className="yas-home-card">
          <Skeleton height="9rem" />
        </Card>
      </div>
    </div>
  );
}
