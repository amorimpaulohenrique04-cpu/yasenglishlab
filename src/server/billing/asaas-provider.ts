import "server-only";
import { z } from "zod";
import {
  checkoutInputSchema,
  providerSubscriptionIdSchema,
  type BillingProvider,
  type CheckoutInput,
} from "@/modules/billing/application/billing-provider";
import {
  safeInvoiceUrl,
  type PendingCharge,
  type ProviderSubscriptionState,
} from "@/modules/billing/domain/regularization";

export function billingConfiguration() {
  const environment = z.enum(["sandbox", "production"]).parse(process.env.ASAAS_ENVIRONMENT);
  const apiKey = z.string().trim().min(1).parse(process.env.ASAAS_API_KEY);
  const appUrl = new URL(z.url().parse(process.env.APP_URL));
  if (
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash ||
    appUrl.pathname !== "/" ||
    (appUrl.protocol !== "https:" &&
      !(
        environment === "sandbox" &&
        appUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(appUrl.hostname)
      ))
  ) {
    throw new Error("Invalid billing application origin");
  }
  return { environment, apiKey, origin: appUrl.origin };
}

export class AsaasBillingProvider implements BillingProvider {
  constructor(private readonly request: typeof fetch = fetch) {}

  checkoutUrl(checkoutId: string) {
    const { environment } = billingConfiguration();
    const id = z.uuid().parse(checkoutId);
    const host = environment === "sandbox" ? "sandbox.asaas.com" : "asaas.com";
    return `https://${host}/checkoutSession/show?id=${encodeURIComponent(id)}`;
  }

  async createCheckout(raw: CheckoutInput) {
    const input = checkoutInputSchema.parse(raw);
    const { environment, apiKey, origin } = billingConfiguration();
    const callback = Object.fromEntries(
      ["success", "cancel", "expired"].map((state) => {
        const url = new URL("/billing/return", origin);
        url.searchParams.set("session", input.sessionId);
        url.searchParams.set("result", state);
        return [`${state}Url`, url.toString()];
      }),
    );
    let response: Response;
    try {
      response = await this.request(
        `https://${environment === "sandbox" ? "api-sandbox" : "api"}.asaas.com/v3/checkouts`,
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: {
            access_token: apiKey,
            "Content-Type": "application/json",
            "User-Agent": "YasEnglishLab/1.0",
          },
          body: JSON.stringify({
            billingTypes: ["CREDIT_CARD"],
            chargeTypes: ["RECURRENT"],
            minutesToExpire: 60,
            externalReference: input.sessionId,
            callback,
            items: [{ name: input.name, quantity: 1, value: input.amountCents / 100 }],
            subscription: { cycle: "MONTHLY", nextDueDate: input.nextDueDate },
          }),
        },
      );
    } catch {
      // Never leak transport errors (which may contain headers), or replay a POST.
      throw new Error("Billing checkout outcome unknown; reconciliation required");
    }
    if (!response.ok) throw new Error(`Billing checkout request failed (${response.status})`);
    let id: string;
    try {
      id = z.object({ id: z.uuid() }).parse(await response.json()).id;
    } catch {
      throw new Error("Billing checkout response invalid; reconciliation required");
    }
    return { checkoutId: id, url: this.checkoutUrl(id) };
  }

  // Read-only GET. Responses are parsed into the minimum we need; nothing else is kept or logged.
  private async get(path: string): Promise<{ status: number; body: unknown }> {
    const { environment, apiKey } = billingConfiguration();
    let response: Response;
    try {
      response = await this.request(
        `https://${environment === "sandbox" ? "api-sandbox" : "api"}.asaas.com/v3${path}`,
        {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: { access_token: apiKey, "User-Agent": "YasEnglishLab/1.0" },
        },
      );
    } catch {
      throw new Error("Billing provider read failed");
    }
    if (response.status === 404) return { status: 404, body: null };
    if (!response.ok) throw new Error(`Billing provider read failed (${response.status})`);
    try {
      return { status: response.status, body: await response.json() };
    } catch {
      throw new Error("Billing provider response invalid");
    }
  }

  // GET /v3/subscriptions/{id}/payments?status=PENDING|OVERDUE (to be confirmed in sandbox homologation).
  async listChargesToRegularize(providerSubscriptionId: string): Promise<PendingCharge[]> {
    const id = providerSubscriptionIdSchema.parse(providerSubscriptionId);
    const schema = z.object({
      data: z.array(
        z.object({
          id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
          dueDate: z.iso.date(),
          value: z.number().positive(),
          status: z.string(),
          deleted: z.boolean().optional(),
          invoiceUrl: z.string().nullish(),
        }),
      ),
    });
    const charges: PendingCharge[] = [];
    for (const status of ["OVERDUE", "PENDING"] as const) {
      const { body } = await this.get(
        `/subscriptions/${encodeURIComponent(id)}/payments?status=${status}&limit=10`,
      );
      if (body === null) continue;
      for (const row of schema.parse(body).data) {
        if (row.deleted || row.status !== status) continue;
        charges.push({
          paymentId: row.id,
          dueDate: row.dueDate,
          amountCents: Math.round(row.value * 100),
          status,
          invoiceUrl: safeInvoiceUrl(row.invoiceUrl),
        });
      }
    }
    return charges.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  // GET /v3/subscriptions/{id}: ACTIVE | INACTIVE | EXPIRED, `deleted` flag; 404 = gone.
  async getSubscriptionState(providerSubscriptionId: string): Promise<ProviderSubscriptionState> {
    const id = providerSubscriptionIdSchema.parse(providerSubscriptionId);
    const { status, body } = await this.get(`/subscriptions/${encodeURIComponent(id)}`);
    if (status === 404) return { status: "NOT_FOUND" };
    const parsed = z
      .object({
        status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]),
        deleted: z.boolean().optional(),
      })
      .parse(body);
    return { status: parsed.deleted ? "NOT_FOUND" : parsed.status };
  }

  // DELETE /v3/subscriptions/{id} (ADR 0013, "Cancel subscription"): stops recurrence. 404 means the
  // subscription is already gone, which is the desired end state (idempotent). No automatic retries.
  async cancelSubscription(providerSubscriptionId: string) {
    const id = providerSubscriptionIdSchema.parse(providerSubscriptionId);
    const { environment, apiKey } = billingConfiguration();
    let response: Response;
    try {
      response = await this.request(
        `https://${environment === "sandbox" ? "api-sandbox" : "api"}.asaas.com/v3/subscriptions/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
          headers: {
            access_token: apiKey,
            "Content-Type": "application/json",
            "User-Agent": "YasEnglishLab/1.0",
          },
        },
      );
    } catch {
      // Never leak transport errors (which may contain headers).
      throw new Error("Billing subscription cancellation outcome unknown");
    }
    if (response.ok || response.status === 404) return;
    throw new Error(`Billing subscription cancellation failed (${response.status})`);
  }
}
