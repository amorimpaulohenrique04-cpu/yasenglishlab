import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getNotificationsCronSecret } from "@/server/env";
import { processPendingNotificationDeliveries } from "./processor";

// Fixed bounded batch (claim RPC allows 1..25). Never taken from the request.
const BATCH_LIMIT = 20;
const headers = { "cache-control": "no-store" } as const;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer (\S+)$/.exec(header) : null;
  if (!match) return false;
  const incoming = Buffer.from(match[1]!);
  const expected = Buffer.from(secret);
  return incoming.length === expected.length && timingSafeEqual(incoming, expected);
}

// Trusted-scheduler entrypoint. Response carries counts only; nothing is logged or echoed.
export async function handleNotificationsCron(
  request: Request,
  secret: string | null = getNotificationsCronSecret(),
): Promise<Response> {
  if (!secret) return new Response(null, { status: 503, headers });
  if (!authorized(request, secret)) return new Response(null, { status: 401, headers });
  try {
    const result = await processPendingNotificationDeliveries(BATCH_LIMIT);
    return Response.json(
      {
        claimed: result.claimed,
        sent: result.sent,
        pending: result.pending,
        failed: result.failed,
        lost: result.lost,
      },
      { headers },
    );
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
