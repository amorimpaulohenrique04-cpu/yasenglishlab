import "server-only";
import { z } from "zod";
import {
  NotificationDeliveryError,
  type EmailDelivery,
  type NotificationDeliveryProvider,
} from "@/modules/notifications/application/delivery";

export class ResendEmailProvider implements NotificationDeliveryProvider {
  constructor(
    private readonly configuration: { apiKey: string; fromEmail: string },
    private readonly request: typeof fetch = fetch,
  ) {
    if (
      !configuration.apiKey ||
      configuration.apiKey.length > 512 ||
      /\s/.test(configuration.apiKey) ||
      !z.email().safeParse(configuration.fromEmail).success
    ) {
      throw new NotificationDeliveryError("INVALID_CONFIG", false);
    }
  }

  async send(email: EmailDelivery): Promise<{ messageId: string }> {
    if (
      !z.email().safeParse(email.to).success ||
      !email.subject ||
      email.subject.length > 200 ||
      /[\r\n]/.test(email.subject) ||
      !email.text ||
      email.text.length > 10_000 ||
      !/^notification-email:[0-9a-f-]{36}$/.test(email.idempotencyKey)
    ) {
      throw new NotificationDeliveryError("INVALID_REQUEST", false);
    }
    let response: Response;
    try {
      response = await this.request("https://api.resend.com/emails", {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "yasenglishlab/notification-delivery-v1",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.configuration.fromEmail,
          to: [email.to],
          subject: email.subject,
          text: email.text,
        }),
      });
    } catch {
      throw new NotificationDeliveryError("NETWORK_ERROR", true);
    }
    if (response.status === 429) throw new NotificationDeliveryError("PROVIDER_RATE_LIMIT", true);
    if (response.status >= 500) throw new NotificationDeliveryError("PROVIDER_UNAVAILABLE", true);
    // Read only a small bounded discriminator/id. Provider bodies never reach storage/logs.
    let payload: unknown;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("empty");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 4096) throw new Error("oversized");
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new NotificationDeliveryError(
        response.ok ? "PROVIDER_RESPONSE_INVALID" : "PROVIDER_REJECTED",
        response.ok,
      );
    }
    if (response.status === 409) {
      const name = z.object({ name: z.string() }).safeParse(payload);
      if (
        name.success &&
        ["concurrent_idempotent_requests", "resource_locked"].includes(name.data.name)
      )
        throw new NotificationDeliveryError("PROVIDER_BUSY", true);
    }
    if (!response.ok) throw new NotificationDeliveryError("PROVIDER_REJECTED", false);
    const accepted = z.object({ id: z.uuid() }).safeParse(payload);
    if (!accepted.success) throw new NotificationDeliveryError("PROVIDER_RESPONSE_INVALID", true);
    return { messageId: accepted.data.id };
  }
}
