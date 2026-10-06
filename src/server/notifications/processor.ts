import "server-only";
import { processNotificationDeliveries } from "@/modules/notifications/application/delivery";
import { createClient } from "@supabase/supabase-js";
import { getNotificationDeliveryEnvironment, getServerSupabaseEnvironment } from "@/server/env";
import { FakeEmailProvider } from "./fake-email-provider";
import { ResendEmailProvider } from "./resend-email-provider";
import { SupabaseNotificationDeliveryRepository } from "./repository";

// Trusted server invocation only. Scheduling/authenticated hosting remains a later decision.
export async function processPendingNotificationDeliveries(limit = 10) {
  const configuration = getNotificationDeliveryEnvironment();
  const provider =
    configuration.provider === "FAKE"
      ? new FakeEmailProvider()
      : new ResendEmailProvider(configuration);
  const environment = getServerSupabaseEnvironment();
  const client = createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
            : AbortSignal.timeout(15_000),
        }),
    },
  });
  const repository = new SupabaseNotificationDeliveryRepository(client);
  return processNotificationDeliveries({ repository, recipients: repository, provider }, limit);
}
