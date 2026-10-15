import type { PracticeResponseInputV2, PracticeResponseV2 } from "../domain/content-v2";

/** Pure helpers behind `PracticePlayer`. No React, no I/O: unit tested in tests/unit. */

export const WRITTEN_MAX_LENGTH = 2000;

export type ClozeSegment = { kind: "text"; value: string } | { kind: "blank"; id: string };

/** Splits `text` on `{{N}}` markers. Repeated markers keep the same blank id. */
export function splitCloze(text: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\{\{([0-9]{1,2})\}\}/g)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: "text", value: text.slice(cursor, index) });
    segments.push({ kind: "blank", id: match[1]! });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}

/** Distinct blank ids in order of first appearance. */
export function clozeBlankIds(text: string): string[] {
  const ids: string[] = [];
  for (const segment of splitCloze(text)) {
    if (segment.kind === "blank" && !ids.includes(segment.id)) ids.push(segment.id);
  }
  return ids;
}

export function moveOrderItem(
  order: readonly string[],
  index: number,
  direction: "up" | "down",
): string[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) {
    return [...order];
  }
  const next = [...order];
  const moved = next[index]!;
  next[index] = next[target]!;
  next[target] = moved;
  return next;
}

export function orderAnnouncement(label: string, position: number, total: number): string {
  return `${label} movido para a posição ${position} de ${total}.`;
}

export interface PlayerAnswerState {
  optionId: string | null;
  optionIds: string[];
  value: boolean | null;
  blanks: Record<string, string>;
  order: string[];
  text: string;
}

export function initialAnswerState(response: PracticeResponseV2): PlayerAnswerState {
  return {
    optionId: null,
    optionIds: [],
    value: null,
    blanks: {},
    order: response.type === "ORDERING" ? response.items.map((item) => item.id) : [],
    text: "",
  };
}

export function toggleOption(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}

/**
 * Builds the payload accepted by `submit_practice_attempt`, or `null` while the answer is incomplete.
 * SPOKEN is never built here: it is `{ mediaId }` after the audio upload flow.
 */
export function buildResponseInput(
  response: PracticeResponseV2,
  state: PlayerAnswerState,
): PracticeResponseInputV2 | null {
  switch (response.type) {
    case "CHOICE_SINGLE":
      return state.optionId ? { optionId: state.optionId } : null;
    case "CHOICE_MULTI":
      return state.optionIds.length > 0 ? { optionIds: [...state.optionIds] } : null;
    case "TRUE_FALSE":
      return state.value === null ? null : { value: state.value };
    case "CLOZE": {
      const blanks: Record<string, string> = {};
      for (const id of clozeBlankIds(response.text)) {
        const answer = (state.blanks[id] ?? "").trim();
        if (!answer) return null;
        blanks[id] = answer;
      }
      return Object.keys(blanks).length > 0 ? { blanks } : null;
    }
    case "ORDERING":
      return state.order.length === response.items.length ? { order: [...state.order] } : null;
    case "WRITTEN": {
      const text = state.text.trim();
      return text && text.length <= WRITTEN_MAX_LENGTH ? { text } : null;
    }
    case "SPOKEN":
      return null;
  }
}

export type PlayerOutcomeStatus =
  "CORRECT" | "INCORRECT" | "PENDING_MANUAL" | "NOT_SCORED" | "MANUAL_REVIEWED";

export interface PlayerOutcome {
  status: PlayerOutcomeStatus;
  feedback: string | null;
}

export function outcomeTitle(status: PlayerOutcomeStatus): string {
  switch (status) {
    case "CORRECT":
      return "Resposta correta";
    case "INCORRECT":
      return "Resposta incorreta";
    case "PENDING_MANUAL":
      return "Aguardando revisão do professor";
    case "MANUAL_REVIEWED":
      return "Feedback do professor disponível";
    default:
      return "Resposta registrada";
  }
}
