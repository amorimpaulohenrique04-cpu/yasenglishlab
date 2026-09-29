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
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    return fallback;
  }

  return normalized;
}

export function normalizeSignedUrlTtl(seconds: number | undefined): number {
  if (!Number.isFinite(seconds)) return 120;
  return Math.min(300, Math.max(30, Math.round(seconds ?? 120)));
}
