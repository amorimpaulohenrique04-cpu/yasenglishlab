import { notFound } from "next/navigation";
import { z } from "zod";

import { Alert } from "@/components/ui";
import { PracticeBuilder } from "@/modules/teacher-operations/ui/practice-builder";
import { SAVE_ERROR_COPY } from "@/modules/teacher-operations/ui/practice-builder-logic";
import { assertRole } from "@/server/auth/guards";
import { getPracticeStimulusUrl } from "@/server/practice/assets";
import {
  getTeacherPractice,
  type TeacherPracticeDetail,
} from "@/server/teacher-operations/practice-commands";
import { loadTeacherPracticeScope } from "@/server/teacher-operations/practice-scope";

import {
  autosavePracticeAction,
  assignPracticeAction,
  completePracticeAssetAction,
  duplicatePracticeAction,
  publishPracticeAction,
  reservePracticeAssetAction,
  savePracticeAction,
  unassignPracticeAction,
  unpublishPracticeAction,
} from "../actions";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ save?: string; reason?: string }>;
}) {
  await assertRole("TEACHER");
  const parsedId = z.uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  let detail: TeacherPracticeDetail;
  try {
    detail = await getTeacherPractice(parsedId.data);
  } catch {
    notFound();
  }
  const [scope, query] = await Promise.all([loadTeacherPracticeScope(), searchParams]);
  const content = detail.content;
  const assetId = "items" in content ? undefined : content.stimulus.assetId;
  const stimulusUrl = assetId ? await getPracticeStimulusUrl(assetId).catch(() => null) : null;
  // Content v3: one signed URL per question asset, keyed by asset id (minted on the server, owner only).
  const itemAssetIds =
    "items" in content
      ? [...new Set(content.items.map((item) => item.stimulus.assetId).filter(Boolean))]
      : [];
  const assetUrls = Object.fromEntries(
    await Promise.all(
      itemAssetIds.map(async (id) => [id, await getPracticeStimulusUrl(id!).catch(() => null)]),
    ),
  ) as Record<string, string | null>;
  const error = SAVE_ERROR_COPY[query.reason ?? ""] ?? SAVE_ERROR_COPY.UNAVAILABLE!;
  return (
    <>
      {query.save === "error" && (
        <Alert tone="error" title={error.title} description={error.description} />
      )}
      {query.save === "success" && <Alert tone="success" title="Alteração concluída" />}
      <PracticeBuilder
        detail={detail}
        scope={scope}
        stimulusUrl={stimulusUrl}
        assetUrls={assetUrls}
        actions={{
          autosave: autosavePracticeAction,
          save: savePracticeAction,
          publish: publishPracticeAction,
          unpublish: unpublishPracticeAction,
          duplicate: duplicatePracticeAction,
          assign: assignPracticeAction,
          unassign: unassignPracticeAction,
          reserveAsset: reservePracticeAssetAction,
          completeAsset: completePracticeAssetAction,
        }}
      />
    </>
  );
}
