import "server-only";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";

import type { TechnicalContext } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeUuid(value: string | null | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function runtimeEnvironment(): string {
  return (process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown").slice(
    0,
    40,
  );
}

function runtimeVersion(): string {
  return (
    process.env.APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.npm_package_version ??
    "unknown"
  ).slice(0, 120);
}

export function createTechnicalContext(
  input: {
    requestId?: string | undefined;
    traceId?: string | undefined;
    spanId?: string | undefined;
    userId?: string | undefined;
    environment?: string | undefined;
    version?: string | undefined;
  } = {},
): TechnicalContext {
  const requestId = safeUuid(input.requestId) ?? randomUUID();

  return {
    requestId,
    traceId: safeUuid(input.traceId) ?? requestId,
    spanId: safeUuid(input.spanId) ?? randomUUID(),
    userId: safeUuid(input.userId),
    environment: (input.environment ?? runtimeEnvironment()).slice(0, 40),
    version: (input.version ?? runtimeVersion()).slice(0, 120),
  };
}

export async function getRequestTechnicalContext(
  input: {
    userId?: string | undefined;
    spanId?: string | undefined;
  } = {},
): Promise<TechnicalContext> {
  try {
    const requestHeaders = await headers();

    return createTechnicalContext({
      requestId: requestHeaders.get("x-request-id") ?? undefined,
      traceId: requestHeaders.get("x-trace-id") ?? undefined,
      spanId: input.spanId,
      userId: input.userId,
    });
  } catch {
    return createTechnicalContext({
      spanId: input.spanId,
      userId: input.userId,
    });
  }
}
