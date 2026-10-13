import type { SubscriptionAccessState } from "@/modules/billing/domain/access";

export type SuspendedAccess = Extract<SubscriptionAccessState, { kind: "suspended" }>;

export type SuspensionContext = "content" | "agenda" | "practice" | "materials" | "profile";

export type SuspensionCopy = {
  badge: string;
  title: string;
  description: string;
  guidance: string;
  action: { label: string; href: string } | null;
};

const scope: Record<SuspensionContext, string> = {
  content: "As aulas e os encontros ao vivo estão em pausa por enquanto.",
  agenda: "Novas reservas e a entrada nos encontros ao vivo estão em pausa por enquanto.",
  practice: "As atividades de prática estão em pausa por enquanto.",
  materials: "Os materiais estão em pausa por enquanto.",
  profile: "O acesso às aulas, materiais, prática e encontros ao vivo está em pausa.",
};

const kept = "Nada foi apagado: seu progresso, suas reservas e seus materiais continuam guardados.";

// Pure copy for the billing suspension (ADR 0016). No interest/penalty is ever mentioned; PAY_PENDING has
// no self-service link yet (docs/OPEN_QUESTIONS.md), so it only points the student to the support channel.
export function suspensionCopy(
  access: SuspendedAccess,
  context: SuspensionContext = "content",
): SuspensionCopy {
  if (access.regularization === "PAY_PENDING") {
    return {
      badge: "Pagamento pendente",
      title: "Há um pagamento pendente na sua assinatura",
      description: `${scope[context]} ${kept}`,
      guidance:
        "Assim que o pagamento for confirmado, o acesso volta sozinho. Se já pagou ou precisa da segunda via da cobrança, fale com o suporte da Yas.",
      action: null,
    };
  }
  const cancelled = access.reason === "CANCELLED";
  return {
    badge: cancelled ? "Assinatura cancelada" : "Assinatura encerrada",
    title: cancelled ? "Sua assinatura foi cancelada" : "Sua assinatura está encerrada",
    description: `${scope[context]} ${kept}`,
    guidance: "Ao reativar a assinatura, o acesso volta e você retoma de onde parou.",
    action: access.canRegularize ? { label: "Reativar assinatura", href: "/checkout" } : null,
  };
}
