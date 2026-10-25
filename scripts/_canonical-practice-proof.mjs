/** ADR 0025: seven final answers, one deliberate mistake, no new reinforcement round. */
export function assertCanonicalPractice({ result, responses }) {
  if (
    result?.score !== 6 ||
    result?.max_score !== 7 ||
    result?.metrics?.itemCount !== 7 ||
    result?.metrics?.firstTryCorrect !== 6 ||
    result?.metrics?.recovered !== 0 ||
    result?.metrics?.missed !== 1 ||
    result?.metrics?.pendingManual !== 0
  ) {
    // Report only numeric diagnostics; never dump responses, credentials or user data into CI.
    throw new Error(
      "Canonical practice must persist seven final answers (6/7), without reinforcement: " +
        JSON.stringify({
          score: result?.score,
          maxScore: result?.max_score,
          itemCount: result?.metrics?.itemCount,
          firstTryCorrect: result?.metrics?.firstTryCorrect,
          recovered: result?.metrics?.recovered,
          missed: result?.metrics?.missed,
          pendingManual: result?.metrics?.pendingManual,
          responseCount: responses?.length,
        }),
    );
  }
  const expectedItems = ["greet-1", "greet-2", "be-1", "ps-1", "ps-2", "ps-3", "order-1"];
  if (
    responses?.length !== 7 ||
    expectedItems.some(
      (id) =>
        !responses.some(
          (row) =>
            row.item_id === id &&
            row.round === 1 &&
            row.evaluation_status === (id === "ps-1" ? "INCORRECT" : "CORRECT"),
        ),
    )
  ) {
    throw new Error("Canonical practice responses are incomplete or duplicated.");
  }
}
