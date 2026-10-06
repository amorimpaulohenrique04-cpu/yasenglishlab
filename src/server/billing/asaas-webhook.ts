import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { BillingEventRepository } from "@/modules/billing/application/billing-event";
import { normalizeAsaasEvent } from "@/server/billing/asaas-events";

const MAX_BYTES = 262144;

async function boundedBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) {
    throw new RangeError("Body too large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Body required");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleAsaasWebhook(
  request: Request,
  repository: () => BillingEventRepository,
  token: string | undefined = process.env.ASAAS_WEBHOOK_TOKEN,
): Promise<Response> {
  // Asaas authToken is distinct from the API key, 32..255 characters, no spaces.
  if (!token || !/^\S{32,255}$/.test(token) || token === process.env.ASAAS_API_KEY) {
    return new Response(null, { status: 503 });
  }
  const incoming = request.headers.get("asaas-access-token");
  if (
    !incoming ||
    Buffer.byteLength(incoming) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(incoming), Buffer.from(token))
  ) {
    return new Response(null, { status: 401 });
  }
  let event;
  try {
    event = normalizeAsaasEvent(await boundedBody(request));
  } catch (error) {
    return new Response(null, { status: error instanceof RangeError ? 413 : 400 });
  }
  try {
    await repository().reconcile(event);
    // Durable rejection/ignored/stale events are acknowledged; only storage
    // outages retry. No body, errors or credentials are echoed or logged.
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
