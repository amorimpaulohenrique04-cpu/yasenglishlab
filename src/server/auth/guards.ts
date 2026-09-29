import "server-only";

import { redirect } from "next/navigation";

import { staffMfaRequired } from "@/modules/auth";
import type { UserRole } from "@/modules/domain";
import { resolveAuthContext, type AuthContext } from "@/server/auth/context";

export type AuthorizationErrorCode = "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN";

export class AuthorizationError extends Error {
  constructor(readonly code: AuthorizationErrorCode) {
    super(code);
    this.name = "AuthorizationError";
  }
}

interface AuthRequirement {
  enforceStaffMfa?: boolean;
}

export async function assertAuthenticated(requirement: AuthRequirement = {}): Promise<AuthContext> {
  const context = await resolveAuthContext();

  if (!context) {
    throw new AuthorizationError("UNAUTHENTICATED");
  }

  if (requirement.enforceStaffMfa !== false && staffMfaRequired(context.roles, context.aal)) {
    throw new AuthorizationError("MFA_REQUIRED");
  }

  return context;
}

export async function assertRole(
  allowedRoles: UserRole | readonly UserRole[],
): Promise<AuthContext> {
  const context = await assertAuthenticated();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!allowed.some((role) => context.roles.includes(role))) {
    throw new AuthorizationError("FORBIDDEN");
  }

  return context;
}

export async function requirePageAuth(requirement: AuthRequirement = {}): Promise<AuthContext> {
  const context = await resolveAuthContext();

  if (!context) {
    redirect("/login");
  }

  if (requirement.enforceStaffMfa !== false && staffMfaRequired(context.roles, context.aal)) {
    redirect("/mfa");
  }

  return context;
}

export async function requirePageRole(
  allowedRoles: UserRole | readonly UserRole[],
): Promise<AuthContext> {
  const context = await requirePageAuth();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!allowed.some((role) => context.roles.includes(role))) {
    redirect("/profile?auth=forbidden");
  }

  return context;
}
