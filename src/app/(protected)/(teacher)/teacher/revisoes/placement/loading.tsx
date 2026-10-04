import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando revisões">
      <Skeleton height="12rem" />
    </div>
  );
}
