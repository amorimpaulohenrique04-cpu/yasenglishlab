const SENSITIVE_KEY =
  /(?:pass(?:word)?|token|authorization|cookie|secret|api[_-]?key|credential|card|cvv|payment|private[_-]?audio|assessment[_-]?response|answer[_-]?key)/i;

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
];

const EMAIL_PATTERN = /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?\d[\s().-]?){8,15}(?!\d)/g;

function sanitizeString(value: string): string {
  let result = value;

  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }

  result = result.replace(
    EMAIL_PATTERN,
    (_match, first: string, _rest: string, domain: string) => `${first}***@${domain}`,
  );
  result = result.replace(PHONE_PATTERN, "[PHONE_REDACTED]");

  return result.slice(0, 500);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 5) return "[TRUNCATED]";

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      sanitized[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : sanitizeValue(nested, depth + 1);
    }

    return sanitized;
  }

  return String(value).slice(0, 200);
}

export function sanitizeMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!input) return {};
  return sanitizeValue(input, 0) as Record<string, unknown>;
}

export function sanitizeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown technical error";

  const sanitized = sanitizeString(message.trim());
  return sanitized.length > 0 ? sanitized : "Technical error";
}
