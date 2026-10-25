import Link from "next/link";
import { Icon, PageHeader } from "@/components/ui";
import { entryFiltersSchema } from "@/modules/placement/domain/entry-workspace";
import { EntryQueue } from "@/modules/placement/ui/entry-queue";
import styles from "@/modules/placement/ui/entry-workspace.module.css";
import { loadEntryQueue } from "@/server/placement/entry-workspace";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
export default async function PlacementReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = entryFiltersSchema.parse(await searchParams);
  const data = await loadEntryQueue(filters);
  return (
    <div className={styles.page}>
      <PageHeader
        title="Revisões de entrada"
        description="Revise os testes dos alunos no seu escopo antes de recomendar uma trilha."
        actions={
          <Link className="yas-button yas-button--ghost yas-button--sm" href="/teacher/revisoes">
            Ver revisões de prática <Icon name="arrow" size={16} />
          </Link>
        }
      />
      <EntryQueue data={data} filters={filters} now={sessionWorkspaceNow()} />
    </div>
  );
}
