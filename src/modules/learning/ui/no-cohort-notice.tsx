import { Alert } from "@/components/ui";
import { NO_COHORT_DESCRIPTION, NO_COHORT_TITLE } from "../domain/errors";

export function NoCohortNotice() {
  return <Alert tone="warning" title={NO_COHORT_TITLE} description={NO_COHORT_DESCRIPTION} />;
}
