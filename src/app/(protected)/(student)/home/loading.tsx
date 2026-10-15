import { Card, PageHeader, Skeleton } from "@/components/ui";

export default function HomeLoading() {
  return (
    <div className="yas-home-page" aria-busy="true" aria-label="Carregando início">
      <PageHeader title="Carregando…" description="Preparando seu próximo passo." />
      <div className="yas-home-top">
        <Skeleton height="15.25rem" style={{ borderRadius: "var(--yas-radius-xl)" }} />
        <Card>
          <Skeleton height="11rem" />
        </Card>
        <Card>
          <Skeleton height="11rem" />
        </Card>
      </div>
      <div className="yas-home-bottom">
        <Card>
          <Skeleton height="12rem" />
        </Card>
        <Card>
          <Skeleton height="9rem" />
        </Card>
      </div>
    </div>
  );
}
