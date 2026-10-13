import { billingDate } from "./presentation";

export type CancelErrorCode =
  "FORBIDDEN" | "ACTIVE_SUBSCRIPTION_REQUIRED" | "PROVIDER_UNAVAILABLE" | "UNAVAILABLE";

export const cancelErrorMessages: Record<CancelErrorCode, { title: string; description: string }> =
  {
    FORBIDDEN: {
      title: "Não foi possível cancelar por aqui",
      description:
        "Não encontramos permissão para alterar esta assinatura. Fale com o suporte e a gente resolve com você.",
    },
    ACTIVE_SUBSCRIPTION_REQUIRED: {
      title: "Não há assinatura ativa para cancelar",
      description:
        "Sua assinatura pode já ter sido alterada. Atualize a página para ver a situação atual.",
    },
    PROVIDER_UNAVAILABLE: {
      title: "Não conseguimos concluir agora",
      description: "Tente novamente em instantes. Nada foi cancelado e sua assinatura segue ativa.",
    },
    UNAVAILABLE: {
      title: "Algo não saiu como esperado",
      description: "Tente novamente em instantes. Se continuar, fale com o suporte.",
    },
  };

export function accessUntilText(accessUntil: string | null) {
  return accessUntil ? billingDate(accessUntil) : null;
}

export function confirmationDescription(accessUntil: string | null) {
  const until = accessUntilText(accessUntil);
  return `A assinatura não será renovada. Você continua com acesso ${
    until ? `até ${until}` : "até o fim do período já pago"
  }. Seu progresso e seus materiais não serão apagados.`;
}

export function scheduledTitle(accessUntil: string | null) {
  const until = accessUntilText(accessUntil);
  return until
    ? `Cancelamento agendado — acesso até ${until}`
    : "Cancelamento agendado — acesso até o fim do período pago";
}

export const scheduledDescription =
  "Sua assinatura não será renovada. Seu progresso e seus materiais continuam guardados.";
