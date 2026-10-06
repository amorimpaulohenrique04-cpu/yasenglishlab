import "server-only";
import { z } from "zod";
import {
  checkoutInputSchema,
  type BillingProvider,
  type CheckoutInput,
} from "@/modules/billing/application/billing-provider";

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
}
