/**
 * Read-only questions of an attempt for the Teacher review page (get_teacher_review_context).
 * Objective questions show the Student's answer and its persisted evaluation; nothing here grades,
 * recalculates a score or touches CEFR. Only WRITTEN/SPOKEN questions are reviewed by hand.
 */

export interface ReviewQuestion {
  itemId: string | null;
  position: number;
  prompt: string;
  responseType: string | null;
  definition: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  evaluationStatus: string | null;
  manual: boolean;
  reviewed: boolean;
  mediaDurationSeconds: number | null;
}

export type QuestionState = "auto" | "pending" | "reviewed";

export const QUESTION_STATE_LABELS: Record<QuestionState, string> = {
  auto: "Corrigida automaticamente",
  pending: "Aguardando professor",
  reviewed: "Revisada",
};

export function questionState(question: Pick<ReviewQuestion, "manual" | "reviewed">) {
  if (!question.manual) return "auto" as const;
  return question.reviewed ? ("reviewed" as const) : ("pending" as const);
}

/** "Correta" / "Incorreta" for an objective question; null when there is no persisted verdict. */
export function objectiveVerdict(status: string | null) {
  if (status === "CORRECT") return "Correta";
  if (status === "INCORRECT") return "Incorreta";
  return null;
}

type Labelled = { id: string; label: string };

function labels(definition: Record<string, unknown> | null, key: "options" | "items") {
  const list = definition?.[key];
  if (!Array.isArray(list)) return [] as Labelled[];
  return list.filter(
    (entry): entry is Labelled =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Labelled).id === "string" &&
      typeof (entry as Labelled).label === "string",
  );
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/** The Student's objective answer in words, from the public response definition (labels only). */
export function describeStudentAnswer(
  definition: Record<string, unknown> | null,
  response: Record<string, unknown> | null,
): string | null {
  if (!response) return null;
  const type = typeof definition?.type === "string" ? definition.type : null;
  const labelOf = (list: Labelled[], id: string) =>
    list.find((entry) => entry.id === id)?.label ?? id;
  if (type === "CHOICE_SINGLE" && typeof response.optionId === "string") {
    return labelOf(labels(definition, "options"), response.optionId);
  }
  if (type === "CHOICE_MULTI") {
    const ids = strings(response.optionIds);
    return ids.length
      ? ids.map((id) => labelOf(labels(definition, "options"), id)).join("; ")
      : null;
  }
  if (type === "TRUE_FALSE" && typeof response.value === "boolean") {
    return response.value ? "Verdadeiro" : "Falso";
  }
  if (type === "CLOZE" && typeof response.blanks === "object" && response.blanks !== null) {
    const blanks = Object.entries(response.blanks as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
    return blanks.length ? blanks.map(([id, text]) => `Lacuna ${id}: ${text}`).join("; ") : null;
  }
  if (type === "ORDERING") {
    const order = strings(response.order);
    return order.length
      ? order
          .map((id, index) => `${index + 1}. ${labelOf(labels(definition, "items"), id)}`)
          .join(" ")
      : null;
  }
  return null;
}

/** "1 de 3 respostas abertas revisadas": open (manual) answers only, never objective ones. */
export function manualProgress(questions: readonly Pick<ReviewQuestion, "manual" | "reviewed">[]) {
  const open = questions.filter((question) => question.manual);
  const reviewed = open.filter((question) => question.reviewed).length;
  return { reviewed, total: open.length, pending: open.length - reviewed };
}

export function manualProgressLabel(progress: { reviewed: number; total: number }) {
  return `${progress.reviewed} de ${progress.total} ${
    progress.total === 1 ? "resposta aberta revisada" : "respostas abertas revisadas"
  }`;
}
