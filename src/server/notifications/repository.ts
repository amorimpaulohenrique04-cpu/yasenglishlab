import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NotificationDeliveryError,
  type ClaimedDelivery,
  type DeliveryErrorCode,
  type NotificationDeliveryRepository,
  type NotificationRecipientResolver,
} from "@/modules/notifications/application/delivery";

const claimSchema = z
  .object({
    delivery_id: z.uuid(),
    user_id: z.uuid(),
    notification_type: z.string(),
    template_version: z.number().int(),
    attempt_count: z.number().int().min(1).max(5),
    idempotency_key: z.string(),
    claim_token: z.uuid(),
  })
  .refine((row) => row.idempotency_key === `notification-email:${row.delivery_id}`);

export class SupabaseNotificationDeliveryRepository
  implements NotificationDeliveryRepository, NotificationRecipientResolver
{
  constructor(private readonly client: SupabaseClient) {}
  async claim(limit: number): Promise<ClaimedDelivery[]> {
    const { data, error } = await this.client.rpc("claim_notification_deliveries", {
      p_limit: limit,
    });
    if (error) throw new Error("NOTIFICATION_CLAIM_FAILED");
    return z
      .array(claimSchema)
      .parse(data)
      .map((row) => ({
        deliveryId: row.delivery_id,
        userId: row.user_id,
        notificationType: row.notification_type,
        templateVersion: row.template_version,
        attemptCount: row.attempt_count,
        idempotencyKey: row.idempotency_key,
        claimToken: row.claim_token,
      }));
  }
  async complete(delivery: ClaimedDelivery, messageId: string) {
    const { data, error } = await this.client.rpc("complete_notification_delivery", {
      p_delivery_id: delivery.deliveryId,
      p_claim_token: delivery.claimToken,
      p_message_id: messageId,
    });
    if (error) throw new Error("NOTIFICATION_COMPLETION_FAILED");
    return z.boolean().parse(data);
  }
  async fail(delivery: ClaimedDelivery, code: DeliveryErrorCode, retryable: boolean) {
    const { data, error } = await this.client.rpc("fail_notification_delivery", {
      p_delivery_id: delivery.deliveryId,
      p_claim_token: delivery.claimToken,
      p_error_code: code,
      p_retryable: retryable,
    });
    if (error) throw new Error("NOTIFICATION_FAILURE_PERSISTENCE_FAILED");
    return z.enum(["PENDING", "FAILED", "LOST"]).parse(data);
  }
  async resolveVerifiedEmail(userId: string) {
    const { data, error } = await this.client.auth.admin.getUserById(userId);
    if (error)
      throw new NotificationDeliveryError(
        error.status === 404 ? "RECIPIENT_MISSING" : "RECIPIENT_LOOKUP_UNAVAILABLE",
        error.status !== 404,
      );
    if (!data.user?.email) throw new NotificationDeliveryError("RECIPIENT_MISSING", false);
    if (!data.user.email_confirmed_at)
      throw new NotificationDeliveryError("RECIPIENT_UNVERIFIED", false);
    const email = z.email().safeParse(data.user.email);
    if (!email.success) throw new NotificationDeliveryError("RECIPIENT_MISSING", false);
    return email.data;
  }
}
