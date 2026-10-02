import type { Cohort, CohortCommand, CohortOptions } from "../domain/models";
export interface CohortRepository {
  list(): Promise<Cohort[]>;
  options(): Promise<CohortOptions>;
  manage(command: CohortCommand): Promise<string>;
}
