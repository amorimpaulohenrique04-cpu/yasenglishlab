import type { ReactNode } from "react";

import type {
  PracticeConfidence,
  PracticeContentV3,
  PracticeContentV3Student,
  PracticeFinalizeResult,
  PracticeItemInput,
  PracticeItemKeys,
  PracticeItemResult,
  PracticeItemRound,
} from "../domain/content-v3";

/**
 * Props of `PracticeSessionPlayer` (src/modules/practice/ui/practice-session-player.tsx), the
 * multi-question player shared by the Student stage (`live`) and the Teacher builder (`preview`).
 * Contract: docs/PRACTICE_V3.md §6.
 */
export interface PracticeSessionLiveFlow {
  attemptId: string;
  submitItem: (input: {
    itemId: string;
    round: PracticeItemRound;
    response: PracticeItemInput;
    confidence: PracticeConfidence | null;
  }) => Promise<PracticeItemResult>;
  finalize: () => Promise<PracticeFinalizeResult>;
  /** Audio upload for SPOKEN items (one media per item). */
  reserveAudio: (itemId: string, mime: string) => Promise<{ mediaId: string; uploadUrl: string }>;
  completeAudio: (mediaId: string) => Promise<void>;
  /** Stored item results, to resume an attempt where the Student stopped. */
  initialResults?: PracticeItemResult[];
  /** REVIEW attempts run only these item ids. */
  itemIds?: string[] | null;
}

/** Teacher review of one manual (WRITTEN/SPOKEN) item, keyed by item id in `manualReviews`. */
export interface PracticeItemReview {
  feedback: string;
  ratings: Record<string, string>;
  rubricVersion: string;
  reviewedAt: string;
}

export interface PracticeSessionPlayerProps {
  content: PracticeContentV3Student | PracticeContentV3;
  mode: "live" | "preview";
  /** Short-lived signed URLs for IMAGE/AUDIO/VIDEO stimuli, keyed by item id. */
  stimulusUrls?: Record<string, string | null>;
  /** Required in `live` mode. */
  live?: PracticeSessionLiveFlow;
  /** `preview` only: Teacher keys used for local grading. Never passed in `live` mode. */
  previewKeys?: PracticeItemKeys;
  /** Practice skill; picks the rubric criteria shown for SPOKEN items (PRONUNCIATION vs SPEAKING). */
  skill?: string;
  /** Reviews already published by the Teacher; a reviewed item is no longer "waiting". */
  manualReviews?: Record<string, PracticeItemReview>;
  /** Rendered under the final summary (e.g. links back to the practice list). */
  resultFooter?: ReactNode;
}
