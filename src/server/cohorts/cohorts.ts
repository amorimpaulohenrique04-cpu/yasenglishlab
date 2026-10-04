import "server-only";
import { manageCohort, type CohortCommand } from "@/modules/cohorts";
import { assertRole, requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { withObservedSpan } from "@/server/observability/trace";
import { SupabaseCohortRepository } from "./supabase-cohort-repository";

export async function loadCohortAdministration(query = "", offset = 0) {
  await requirePageRole("ADMIN");
  const repository = new SupabaseCohortRepository(await createSupabaseServerClient());
  const [cohorts, options] = await Promise.all([
    repository.list(25, offset, query),
    repository.options(),
  ]);
  return { cohorts, options, limit: 25, offset, query };
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

export async function configureCurrentAdminCohort(
  cohortId: string,
  capacity: number,
  schedule: { weekday: number; startMinute: number; endMinute: number }[],
) {
  const auth = await assertRole("ADMIN");
  const repository = new SupabaseCohortRepository(await createSupabaseServerClient());
  return withObservedSpan(
    {
      name: "cohort.placement_configure",
      stage: "cohort.command",
      errorCode: "database_error",
      impact: "user_blocked",
      userId: auth.userId,
    },
    () => repository.configure(cohortId, capacity, schedule),
  );
}

export async function setCurrentAdminPrimaryTeacher(cohortId: string, teacherId: string) {
  const auth = await assertRole("ADMIN");
  const repository = new SupabaseCohortRepository(await createSupabaseServerClient());
  return withObservedSpan(
    {
      name: "cohort.primary_teacher",
      stage: "cohort.command",
      errorCode: "database_error",
      impact: "user_blocked",
      userId: auth.userId,
    },
    () => repository.setPrimaryTeacher(cohortId, teacherId),
  );
}
