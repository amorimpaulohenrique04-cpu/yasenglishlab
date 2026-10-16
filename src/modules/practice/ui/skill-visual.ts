import type { IconName, Tint } from "@/components/ui";
import type { PracticeSkill } from "@/modules/domain";

/** Ícone e tom pastel de cada habilidade: o mesmo par em Home, Prática e Progresso. */
export const practiceSkillVisual: Record<PracticeSkill, { icon: IconName; tint: Tint }> = {
  SPEAKING: { icon: "chat", tint: "lilac" },
  LISTENING: { icon: "headphones", tint: "blue" },
  PRONUNCIATION: { icon: "mic", tint: "yellow" },
  VOCABULARY: { icon: "book", tint: "green" },
  GRAMMAR: { icon: "grad", tint: "pink" },
  WRITING: { icon: "pen", tint: "lilac" },
};
