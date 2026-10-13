import { Alert } from "@/components/ui";
import { scheduledDescription, scheduledTitle } from "./cancellation-copy";

// Shown for both CANCEL_SCHEDULED and CANCELLED_WITH_ACCESS. No "undo" and no new-checkout CTA here: the
// student still has access; the suspension notice offers a new subscription once access ends.
export function CancellationNotice({ accessUntil }: { accessUntil: string | null }) {
  return (
    <Alert tone="info" title={scheduledTitle(accessUntil)} description={scheduledDescription} />
  );
}
