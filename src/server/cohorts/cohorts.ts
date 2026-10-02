import "server-only";
import { manageCohort, type CohortCommand } from "@/modules/cohorts";
import { assertRole, requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { withObservedSpan } from "@/server/observability/trace";
import { SupabaseCohortRepository } from "./supabase-cohort-repository";

export async function loadCohortAdministration() {
  await requirePageRole("ADMIN");
  const repository = new SupabaseCohortRepository(await createSupabaseServerClient());
  const [cohorts, options] = await Promise.all([repository.list(), repository.options()]);
  return { cohorts, options };
}
export async function manageCurrentAdminCohort(command: CohortCommand) {
  const auth = await assertRole("ADMIN");
  const repository = new SupabaseCohortRepository(await createSupabaseServerClient());
  return withObservedSpan(
    {
      name: "cohort.manage",
      stage: "cohort.command",
      errorCode: "database_error",
      impact: "user_blocked",
      userId: auth.userId,
      metadata: { operation: command.operation },
    },
    () => manageCohort(repository, command),
  );
}
