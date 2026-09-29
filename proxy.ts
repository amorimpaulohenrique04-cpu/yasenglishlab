import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validCorrelationId(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const traceId = validCorrelationId(request.headers.get("x-trace-id")) ?? requestId;
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-trace-id", traceId);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-trace-id", traceId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
