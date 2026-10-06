import { handleAsaasWebhook } from "@/server/billing/asaas-webhook";
import { SupabaseBillingEventRepository } from "@/server/billing/event-repository";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleAsaasWebhook(
    request,
    () => new SupabaseBillingEventRepository(createSupabaseAdminClient()),
  );
}
