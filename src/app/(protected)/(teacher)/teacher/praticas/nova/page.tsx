import { Alert } from "@/components/ui";
import { PracticeBuilder } from "@/modules/teacher-operations/ui/practice-builder";
import { SAVE_ERROR_COPY } from "@/modules/teacher-operations/ui/practice-builder-logic";
import { assertRole } from "@/server/auth/guards";
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

export default async function NewPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ save?: string; reason?: string }>;
}) {
  await assertRole("TEACHER");
  const [scope, query] = await Promise.all([loadTeacherPracticeScope(), searchParams]);
  const error = SAVE_ERROR_COPY[query.reason ?? ""] ?? SAVE_ERROR_COPY.UNAVAILABLE!;
  return (
    <>
      {query.save === "error" && (
        <Alert tone="error" title={error.title} description={error.description} />
      )}
      <PracticeBuilder
        detail={null}
        scope={scope}
        stimulusUrl={null}
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
