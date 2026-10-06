import "server-only";
import { randomUUID } from "node:crypto";
import {
  NotificationDeliveryError,
  type EmailDelivery,
  type NotificationDeliveryProvider,
} from "@/modules/notifications/application/delivery";

export class FakeEmailProvider implements NotificationDeliveryProvider {
  readonly accepted = new Map<string, { email: EmailDelivery; messageId: string }>();
  readonly attempts: EmailDelivery[] = [];
  constructor(private readonly outcomes: NotificationDeliveryError[] = []) {
    if (
      process.env.NODE_ENV !== "test" &&
      !(process.env.NODE_ENV === "development" && isLoopback(process.env.APP_URL))
    )
      throw new NotificationDeliveryError("INVALID_CONFIG", false);
  }
  async send(email: EmailDelivery) {
    this.attempts.push(email);
    const prior = this.accepted.get(email.idempotencyKey);
    if (prior) {
      if (JSON.stringify(prior.email) !== JSON.stringify(email))
        throw new NotificationDeliveryError("PROVIDER_REJECTED", false);
      return { messageId: prior.messageId };
    }
    const failure = this.outcomes.shift();
    if (failure) throw failure;
    const messageId = `fake-${randomUUID()}`;
    this.accepted.set(email.idempotencyKey, { email, messageId });
    return { messageId };
  }
}

function isLoopback(value: string | undefined) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value ?? "").hostname);
  } catch {
    return false;
  }
}
