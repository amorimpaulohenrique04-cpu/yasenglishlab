import type { UserRole } from "@/modules/domain";
import { sanitizeNextPath, staffMfaRequired, type AuthenticatorAssuranceLevel } from "./security";

export const WORKSPACES = [
  { role: "STUDENT", href: "/home", label: "Aluno" },
  { role: "TEACHER", href: "/teacher", label: "Professor" },
  { role: "ADMIN", href: "/admin", label: "Administração" },
] as const;

export function authorizedWorkspaces(roles: readonly UserRole[]) {
  return WORKSPACES.filter((workspace) => roles.includes(workspace.role));
}

export function authorizedNextPath(
  roles: readonly UserRole[],
  value?: string | null,
): string | null {
  const next = sanitizeNextPath(value, "");
  if (!next) return null;
  const pathname = new URL(next, "https://yas.invalid").pathname;
  if (pathname === "/profile" || pathname === "/reset-password") return next;
  if (pathname === "/checkout" || pathname === "/billing/return") {
    return roles.includes("STUDENT") ? next : null;
  }
  const root = pathname.split("/")[1] ?? "";
  const role = ["home", "aulas", "pratica", "materiais", "progresso", "agenda"].includes(root)
    ? "STUDENT"
    : root === "teacher"
      ? "TEACHER"
      : root === "admin"
        ? "ADMIN"
        : null;
  return role && roles.includes(role) ? next : null;
}

export function authContinuePath(next?: string | null): string {
  const safe = sanitizeNextPath(next, "");
  return safe ? `/auth/continue?next=${encodeURIComponent(safe)}` : "/auth/continue";
}

export function resolveAuthDestination(
  context: {
    roles: readonly UserRole[];
    aal: AuthenticatorAssuranceLevel;
  },
  next?: string | null,
): string {
  const destination = authorizedNextPath(context.roles, next);
  if (staffMfaRequired(context.roles, context.aal)) {
    return `/mfa?next=${encodeURIComponent(destination ?? "")}`;
  }
  if (destination) return destination;
  const workspaces = authorizedWorkspaces(context.roles);
  return workspaces.length > 1 ? "/workspace" : (workspaces[0]?.href ?? "/profile");
}
