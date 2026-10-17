/** Internal teacher-review deadline. Staff-only: never render it in the Student workspace. */
export const reviewDeadlineHours = 24;
export const reviewWarningHours = 20;

export type ReviewSlaStatus = "ON_TIME" | "APPROACHING" | "OVERDUE";

export function reviewSlaStatus(enteredReviewAt: string | Date, now: Date = new Date()) {
  const hours = (now.getTime() - new Date(enteredReviewAt).getTime()) / 3_600_000;
  const status: ReviewSlaStatus =
    hours >= reviewDeadlineHours
      ? "OVERDUE"
      : hours >= reviewWarningHours
        ? "APPROACHING"
        : "ON_TIME";
  return { status, hours: Math.max(0, hours) };
}

export const reviewSlaLabels: Record<ReviewSlaStatus, string> = {
  ON_TIME: "Em prazo",
  APPROACHING: "Aproximando 24h",
  OVERDUE: "Atrasado",
};
