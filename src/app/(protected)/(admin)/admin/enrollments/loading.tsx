import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando matrículas">
      <Skeleton height="12rem" />
    </div>
  );
}
