import { notFound } from "next/navigation";
import {
  entryDetailUrl,
  entryFiltersSchema,
  entryUrl,
} from "@/modules/placement/domain/entry-workspace";
import { EntryDetail } from "@/modules/placement/ui/entry-detail";
import { loadTeacherPlacement } from "@/server/placement/placement";
import { loadEntryDraft, loadEntryNeighbors } from "@/server/placement/entry-workspace";
import { saveEntryWorkspace } from "../workspace-actions";
import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const filters = entryFiltersSchema.parse(query);
  const [context, personal, nav] = await Promise.all([
    loadTeacherPlacement(id),
    loadEntryDraft(id),
    loadEntryNeighbors(id, filters),
  ]);
  if (!context.view) notFound();
  return (
    <EntryDetail
      key={id}
      context={context}
      initialDraft={personal.draft}
      initialHistory={personal.savedAt}
      caseId={id}
      listHref={entryUrl(filters)}
      previousHref={nav.prev ? entryDetailUrl(nav.prev, { ...filters, page: nav.prevPage }) : null}
      nextHref={nav.next ? entryDetailUrl(nav.next, { ...filters, page: nav.nextPage }) : null}
      position={nav.position}
      total={nav.total}
      now={sessionWorkspaceNow()}
      action={saveEntryWorkspace.bind(null, filters)}
    />
  );
}
