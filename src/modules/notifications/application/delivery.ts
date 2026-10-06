export type DeliveryErrorCode =
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "PROVIDER_BUSY"
  | "PROVIDER_REJECTED"
  | "PROVIDER_RESPONSE_INVALID"
  | "INVALID_CONFIG"
  | "INVALID_REQUEST"
  | "RECIPIENT_MISSING"
  | "RECIPIENT_UNVERIFIED"
  | "RECIPIENT_LOOKUP_UNAVAILABLE"
  | "UNSUPPORTED_TEMPLATE"
  | "PROCESSOR_ERROR";

export class NotificationDeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "NotificationDeliveryError";
  }
}

export type EmailDelivery = Readonly<{
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}>;
export interface NotificationDeliveryProvider {
  send(email: EmailDelivery): Promise<{ messageId: string }>;
}
export type ClaimedDelivery = Readonly<{
  deliveryId: string;
  userId: string;
  notificationType: string;
  templateVersion: number;
  attemptCount: number;
  idempotencyKey: string;
  claimToken: string;
}>;
export interface NotificationDeliveryRepository {
  claim(limit: number): Promise<ClaimedDelivery[]>;
  complete(delivery: ClaimedDelivery, messageId: string): Promise<boolean>;
  fail(
    delivery: ClaimedDelivery,
    code: DeliveryErrorCode,
    retryable: boolean,
  ): Promise<"PENDING" | "FAILED" | "LOST">;
}
export interface NotificationRecipientResolver {
  resolveVerifiedEmail(userId: string): Promise<string>;
}

const templates = {
  PAYMENT_CONFIRMED: {
    subject: "Pagamento confirmado",
    text: "Seu pagamento foi confirmado e sua assinatura Yas está ativa.",
  },
  PAYMENT_ISSUE: {
    subject: "Há uma pendência no seu pagamento",
    text: "Identificamos uma pendência na sua assinatura Yas.",
  },
  SUBSCRIPTION_ENDED: {
    subject: "Sua assinatura foi encerrada",
    text: "Sua assinatura Yas foi encerrada.",
  },
} as const;

export function renderNotificationEmail(
  type: string,
  version: number,
): { subject: string; text: string } {
  if (version !== 1 || !Object.hasOwn(templates, type)) {
    throw new NotificationDeliveryError("UNSUPPORTED_TEMPLATE", false);
  }
  return templates[type as keyof typeof templates];
}

export async function processNotificationDeliveries(
  dependencies: {
    repository: NotificationDeliveryRepository;
    recipients: NotificationRecipientResolver;
    provider: NotificationDeliveryProvider;
  },
  limit = 10,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new NotificationDeliveryError("INVALID_REQUEST", false);
  }
  const deliveries = await dependencies.repository.claim(limit);
  const result = { claimed: deliveries.length, sent: 0, pending: 0, failed: 0, lost: 0 };
  // Start the bounded batch immediately; no queued send can outlive its claim lease.
  const outcomes = await Promise.allSettled(
    deliveries.map(async (delivery) => {
      let accepted: { messageId: string };
      try {
        const template = renderNotificationEmail(
          delivery.notificationType,
          delivery.templateVersion,
        );
        const to = await dependencies.recipients.resolveVerifiedEmail(delivery.userId);
        accepted = await dependencies.provider.send({
          ...template,
          to,
          idempotencyKey: delivery.idempotencyKey,
        });
      } catch (cause) {
        const error =
          cause instanceof NotificationDeliveryError
            ? cause
            : new NotificationDeliveryError("PROCESSOR_ERROR", false);
        const outcome = await dependencies.repository.fail(delivery, error.code, error.retryable);
        if (outcome === "PENDING") result.pending++;
        else if (outcome === "FAILED") result.failed++;
        else result.lost++;
        return;
      }
      // Persistence failure after acceptance leaves the lease recoverable with the SAME key.
      // Never turn an accepted send into a provider failure or rotate its identity.
      if (await dependencies.repository.complete(delivery, accepted.messageId)) result.sent++;
      else result.lost++;
    }),
  );
  const failure = outcomes.find((outcome) => outcome.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return result;
}
