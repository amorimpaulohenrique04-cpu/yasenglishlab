import type { UserRole } from "@/modules/domain";

export type AuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

export const STAFF_ROLES = ["TEACHER", "SUPPORT", "ADMIN"] as const satisfies readonly UserRole[];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);
}

export function staffMfaRequired(
  roles: readonly UserRole[],
  assuranceLevel: AuthenticatorAssuranceLevel,
): boolean {
  return roles.some(isStaffRole) && assuranceLevel !== "aal2";
}

export function sanitizeNextPath(value: string | null | undefined, fallback = "/profile"): string {
  if (!value) return fallback;

  const normalized = value.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return fallback;
  }
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    /[\\\x00-\x20\x7f]/.test(decoded) ||
    decoded.startsWith("//") ||
    /%[0-9a-f]{2}/i.test(decoded)
  ) {
    return fallback;
  }

  const url = new URL(normalized, "https://yas.invalid");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeSignedUrlTtl(seconds: number | undefined): number {
  if (!Number.isFinite(seconds)) return 120;
  return Math.min(300, Math.max(30, Math.round(seconds ?? 120)));
}
