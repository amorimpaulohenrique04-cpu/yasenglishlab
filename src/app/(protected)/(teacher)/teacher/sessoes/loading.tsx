import { Skeleton } from "@/components/ui";
export default function LoadingSessions() {
  return (
    <div className="yas-stack" role="status" aria-label="Carregando sessões">
      <Skeleton height="3rem" />
      <Skeleton height="5rem" />
      <Skeleton height="15rem" />
      <span>Carregando sessões…</span>
    </div>
  );
}
