import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div className="yas-stack" role="status" aria-label="Carregando sua entrada">
      <Skeleton width="60%" height="2.5rem" />
      <Skeleton height="15rem" />
    </div>
  );
}
