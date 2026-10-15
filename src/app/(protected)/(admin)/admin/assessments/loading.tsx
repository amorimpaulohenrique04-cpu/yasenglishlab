import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando avaliações">
      <Skeleton style={{ height: 160 }} />
    </div>
  );
}
