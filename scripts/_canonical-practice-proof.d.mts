export function assertCanonicalPractice(proof: {
  result: {
    score: number;
    max_score: number;
    metrics: {
      itemCount: number;
      firstTryCorrect: number;
      recovered: number;
      missed: number;
      pendingManual: number;
    };
  };
  responses: { item_id: string; round: number; evaluation_status: string }[];
}): void;
