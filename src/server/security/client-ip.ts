import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

function validIp(candidate: string | undefined): string | null {
  if (!candidate) return null;
  const value = candidate.trim();
  if (value.length === 0 || value.length > 45) return null;
  return isIP(value) === 0 ? null : value.toLowerCase();
}

// Pure parsing only. The deployment proxy must overwrite x-forwarded-for; otherwise the
// first hop is client-controlled and only weakens (never bypasses) the per-email limits.
export function clientIp(headers: HeaderReader): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = validIp(forwarded.split(",")[0]);
    if (first) return first;
  }
  return validIp(headers.get("x-real-ip") ?? undefined);
}
