import "server-only";

import { sanitizeMetadata } from "./privacy";

export function writeStructuredLog(
  level: "info" | "warning" | "error",
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    log_schema: "yas.technical.v1",
    ...sanitizeMetadata(payload),
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warning") {
    console.warn(line);
    return;
  }

  console.info(line);
}
