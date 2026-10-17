import { previewGrade, type AnswerKeyV2, type PracticeContentV2 } from "./content-v2";
import {
  isObjectiveItem,
  type PracticeItemInput,
  type PracticeItemKey,
  type PracticeItemResult,
  type PracticeItemRound,
  type PracticeItemV3,
} from "./content-v3";

/**
 * Pure state machine of a v3 practice session (docs/PRACTICE_V3.md section 6).
 * Round 1 walks the items in order; the reinforcement round (round 2) revisits the objective items that
 * were INCORRECT in round 1; then the summary. The state is derived from the stored item results, so a
 * session resumes exactly where the Student stopped.
 */

export type SessionStep =
  | { phase: "ROUND_1"; itemId: string; index: number; total: number }
  | { phase: "ROUND_2"; itemId: string; index: number; total: number }
  | { phase: "SUMMARY" };

/** Items of the attempt in content order; REVIEW attempts run only `itemIds`. */
export function sessionItems(
  items: readonly PracticeItemV3[],
  itemIds?: readonly string[] | null,
): PracticeItemV3[] {
  if (!itemIds) return [...items];
  const wanted = new Set(itemIds);
  return items.filter((item) => wanted.has(item.id));
}

export function resultFor(
  results: readonly PracticeItemResult[],
  itemId: string,
  round: PracticeItemRound,
): PracticeItemResult | undefined {
  return results.find((result) => result.itemId === itemId && result.round === round);
}

/** Stores a result; the same (item, round) replaces the previous one (the RPC is idempotent). */
export function upsertResult(
  results: readonly PracticeItemResult[],
  next: PracticeItemResult,
): PracticeItemResult[] {
  return [
    ...results.filter((result) => !(result.itemId === next.itemId && result.round === next.round)),
    next,
  ];
}

/** True when the item is objective and was answered INCORRECT in round 1. */
export function needsReinforcement(
  item: PracticeItemV3,
  results: readonly PracticeItemResult[],
): boolean {
  return isObjectiveItem(item) && resultFor(results, item.id, 1)?.evaluationStatus === "INCORRECT";
}

export function nextStep(
  items: readonly PracticeItemV3[],
  results: readonly PracticeItemResult[],
): SessionStep {
  const total = items.length;
  const firstPending = items.findIndex((item) => !resultFor(results, item.id, 1));
  if (firstPending >= 0) {
    return { phase: "ROUND_1", itemId: items[firstPending]!.id, index: firstPending + 1, total };
  }
  const retries = items.filter((item) => needsReinforcement(item, results));
  const pendingRetry = retries.findIndex((item) => !resultFor(results, item.id, 2));
  if (pendingRetry >= 0) {
    return {
      phase: "ROUND_2",
      itemId: retries[pendingRetry]!.id,
      index: pendingRetry + 1,
      total: retries.length,
    };
  }
  return { phase: "SUMMARY" };
}

export function progressLabel(step: SessionStep): string {
  if (step.phase === "ROUND_1") return `Pergunta ${step.index} de ${step.total}`;
  if (step.phase === "ROUND_2") return `Reforço ${step.index} de ${step.total}`;
  return "Resumo";
}

// ---------------------------------------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------------------------------------
export type ItemOutcome = "FIRST_TRY" | "RECOVERED" | "MISSED" | "SKIPPED" | "PENDING_MANUAL";

export interface SessionSummary {
  itemCount: number;
  objectiveTotal: number;
  firstTryCorrect: number;
  recovered: number;
  missed: number;
  skipped: number;
  pendingManual: number;
  perItem: { itemId: string; outcome: ItemOutcome }[];
}

function outcomeOf(
  item: PracticeItemV3,
  results: readonly PracticeItemResult[],
): ItemOutcome | null {
  const first = resultFor(results, item.id, 1);
  if (!first) return null;
  if (first.evaluationStatus === "PENDING_MANUAL") return "PENDING_MANUAL";
  if (first.evaluationStatus === "CORRECT") return "FIRST_TRY";
  const second = resultFor(results, item.id, 2);
  if (second?.evaluationStatus === "CORRECT") return "RECOVERED";
  if (second?.evaluationStatus === "SKIPPED") return "SKIPPED";
  return "MISSED";
}

export function summarize(
  items: readonly PracticeItemV3[],
  results: readonly PracticeItemResult[],
): SessionSummary {
  const perItem = items.flatMap((item) => {
    const outcome = outcomeOf(item, results);
    return outcome ? [{ itemId: item.id, outcome }] : [];
  });
  const count = (outcome: ItemOutcome) =>
    perItem.filter((entry) => entry.outcome === outcome).length;
  return {
    itemCount: items.length,
    objectiveTotal: items.filter(isObjectiveItem).length,
    firstTryCorrect: count("FIRST_TRY"),
    recovered: count("RECOVERED"),
    missed: count("MISSED"),
    skipped: count("SKIPPED"),
    pendingManual: count("PENDING_MANUAL"),
    perItem,
  };
}

/** "6 de 8 na 1ª tentativa · 2 recuperadas" */
export function summaryLine(summary: SessionSummary): string {
  if (summary.objectiveTotal === 0) {
    return summary.pendingManual === 1
      ? "1 resposta enviada para revisão do professor"
      : `${summary.pendingManual} respostas enviadas para revisão do professor`;
  }
  const base = `${summary.firstTryCorrect} de ${summary.objectiveTotal} na 1ª tentativa`;
  if (summary.recovered === 0) return base;
  return `${base} · ${summary.recovered} ${summary.recovered === 1 ? "recuperada" : "recuperadas"}`;
}

export const OUTCOME_LABEL: Record<ItemOutcome, string> = {
  FIRST_TRY: "Certa na 1ª tentativa",
  RECOVERED: "Recuperada no reforço",
  MISSED: "Ainda precisa de revisão",
  SKIPPED: "Pulada",
  PENDING_MANUAL: "Aguardando revisão do professor",
};

// ---------------------------------------------------------------------------------------------------------
// Correct answer text (revealed only after round 2 or a skip, decision B)
// ---------------------------------------------------------------------------------------------------------
export function describeCorrectAnswer(
  item: PracticeItemV3,
  answer: AnswerKeyV2 | null,
): string | null {
  if (!answer) return null;
  const { response } = item;
  const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
    list.find((entry) => entry.id === id)?.label ?? id;

  if (response.type === "CHOICE_SINGLE" && "optionId" in answer) {
    return labelOf(response.options, answer.optionId);
  }
  if (response.type === "CHOICE_MULTI" && "optionIds" in answer) {
    return answer.optionIds.map((id) => labelOf(response.options, id)).join("; ");
  }
  if (response.type === "TRUE_FALSE" && "value" in answer) {
    return answer.value ? "Verdadeiro" : "Falso";
  }
  if (response.type === "CLOZE" && "blanks" in answer) {
    return answer.blanks
      .map((blank, index) => `Lacuna ${index + 1}: ${blank.accepted[0] ?? ""}`)
      .join("; ");
  }
  if (response.type === "ORDERING" && "order" in answer) {
    return answer.order
      .map((id, index) => `${index + 1}. ${labelOf(response.items, id)}`)
      .join(" ");
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Teacher preview: local grading with the Teacher's keys (never used in live mode)
// ---------------------------------------------------------------------------------------------------------
export type PreviewItemOutcome = PracticeItemResult | { invalid: string };

function selectedOptionIds(input: PracticeItemInput): string[] {
  if ("optionId" in input) return [input.optionId];
  if ("optionIds" in input) return input.optionIds;
  return [];
}

export function previewItemResult(
  item: PracticeItemV3,
  key: PracticeItemKey | undefined,
  round: PracticeItemRound,
  input: PracticeItemInput,
): PreviewItemOutcome {
  const base = { itemId: item.id, round };
  if ("skip" in input) {
    return {
      ...base,
      evaluationStatus: "SKIPPED",
      feedback: null,
      optionFeedback: null,
      correctAnswer: key?.answerKey ?? null,
      canRetry: false,
    };
  }
  if (!isObjectiveItem(item)) {
    return {
      ...base,
      evaluationStatus: "PENDING_MANUAL",
      feedback: null,
      optionFeedback: null,
      correctAnswer: null,
      canRetry: false,
    };
  }
  const asV2: PracticeContentV2 = {
    version: 2,
    stimulus: item.stimulus,
    prompt: item.prompt,
    response: item.response,
  };
  const graded = previewGrade(asV2, key?.answerKey, input);
  if (graded.status === "INVALID") return { invalid: graded.reason };
  if (graded.status === "MANUAL") {
    return {
      ...base,
      evaluationStatus: "PENDING_MANUAL",
      feedback: null,
      optionFeedback: null,
      correctAnswer: null,
      canRetry: false,
    };
  }
  const feedback = key?.feedback;
  const optionFeedback =
    selectedOptionIds(input)
      .map((id) => feedback?.options?.[id])
      .filter((text): text is string => Boolean(text))
      .join(" ") || null;
  return {
    ...base,
    evaluationStatus: graded.status,
    feedback: (graded.status === "CORRECT" ? feedback?.correct : feedback?.incorrect) ?? null,
    optionFeedback,
    correctAnswer: round === 2 ? (key?.answerKey ?? null) : null,
    canRetry: round === 1 && graded.status === "INCORRECT",
  };
}
