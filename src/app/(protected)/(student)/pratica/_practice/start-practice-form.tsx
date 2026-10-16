import { randomUUID } from "node:crypto";

import { Button } from "@/components/ui";
import type { PracticeActivityItem } from "@/modules/practice";

import { startPracticeAction, startPracticeReviewAction } from "../actions";

/** Inicia uma tentativa (idempotente por chave) e abre a prática em tela cheia. */
export function StartPracticeForm({
  activity,
  label = "Praticar",
  large = false,
  soft = false,
  review = false,
}: {
  activity: Pick<PracticeActivityItem, "id">;
  label?: string;
  large?: boolean;
  soft?: boolean;
  /** Starts a spaced-review attempt over the due questions instead of a full practice. */
  review?: boolean;
}) {
  return (
    <form
      className="yas-practice-start"
      action={review ? startPracticeReviewAction : startPracticeAction}
    >
      <input type="hidden" name="activityId" value={activity.id} />
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      <Button type="submit" variant={soft ? "soft" : "primary"} size={large ? "lg" : "sm"}>
        {label} →
      </Button>
    </form>
  );
}
