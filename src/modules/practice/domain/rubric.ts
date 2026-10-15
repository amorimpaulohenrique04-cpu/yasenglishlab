export const RUBRIC_VERSION = "v1";
export const RUBRIC_LEVELS = ["NEEDS_WORK", "DEVELOPING", "SOLID", "STRONG"] as const;
export const RUBRIC_DIMENSIONS = {
  SPEAKING: [
    "task_completion",
    "comprehensibility",
    "fluency",
    "language_accuracy",
    "vocabulary_use",
    "pronunciation_intelligibility",
  ],
  PRONUNCIATION: ["intelligibility", "target_sounds", "word_stress", "sentence_stress_rhythm"],
} as const;
const WRITTEN_DIMENSIONS = [
  "task_completion",
  "comprehensibility",
  "language_accuracy",
  "vocabulary_use",
] as const;

/** Mirrors finalize_practice_review: WRITTEN -> 4 written dimensions; PRONUNCIATION -> 4; otherwise the 6 speaking ones. */
export function rubricDimensionsFor(
  skill: string,
  responseType?: string | null,
): readonly string[] {
  if (responseType === "WRITTEN") return WRITTEN_DIMENSIONS;
  if (skill === "PRONUNCIATION") return RUBRIC_DIMENSIONS.PRONUNCIATION;
  return RUBRIC_DIMENSIONS.SPEAKING;
}

export const RUBRIC_LABELS: Record<string, string> = {
  task_completion: "Realização da tarefa",
  comprehensibility: "Compreensibilidade",
  fluency: "Fluência",
  language_accuracy: "Precisão linguística",
  vocabulary_use: "Uso de vocabulário",
  pronunciation_intelligibility: "Inteligibilidade da pronúncia",
  intelligibility: "Inteligibilidade",
  target_sounds: "Sons trabalhados",
  word_stress: "Acentuação de palavras",
  sentence_stress_rhythm: "Acentuação e ritmo da frase",
  NEEDS_WORK: "Precisa de atenção",
  DEVELOPING: "Em desenvolvimento",
  SOLID: "Consistente",
  STRONG: "Forte",
};
