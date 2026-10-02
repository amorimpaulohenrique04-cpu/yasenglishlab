import { cohortCommandSchema, type CohortCommand } from "../domain/models";
import type { CohortRepository } from "./ports";
export async function manageCohort(repository: CohortRepository, input: CohortCommand) {
  return repository.manage(cohortCommandSchema.parse(input));
}
