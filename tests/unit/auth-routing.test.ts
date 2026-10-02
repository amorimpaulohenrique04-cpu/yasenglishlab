import { describe, expect, it } from "vitest";
import { authContinuePath, authorizedNextPath, resolveAuthDestination } from "@/modules/auth";

describe("role-aware auth destination", () => {
  it("routes each workspace and neutral accounts", () => {
    expect(resolveAuthDestination({ roles: ["STUDENT"], aal: "aal1" })).toBe("/home");
    expect(resolveAuthDestination({ roles: ["TEACHER"], aal: "aal2" })).toBe("/teacher");
    expect(resolveAuthDestination({ roles: ["ADMIN"], aal: "aal2" })).toBe("/admin");
    expect(resolveAuthDestination({ roles: ["SUPPORT"], aal: "aal2" })).toBe("/profile");
    expect(resolveAuthDestination({ roles: [], aal: "aal1" })).toBe("/profile");
  });
  it("requires MFA before any staff workspace including multi-role", () => {
    for (const role of ["TEACHER", "ADMIN", "SUPPORT"] as const) {
      expect(resolveAuthDestination({ roles: [role], aal: "aal1" })).toMatch(/^\/mfa/);
    }
    expect(resolveAuthDestination({ roles: ["STUDENT", "TEACHER"], aal: "aal1" }, "/home")).toBe(
      "/mfa?next=%2Fhome",
    );
  });
  it("selects multiple workspaces without silent precedence", () => {
    const context = { roles: ["TEACHER", "ADMIN"] as const, aal: "aal2" as const };
    expect(resolveAuthDestination(context)).toBe("/workspace");
    expect(resolveAuthDestination(context, "/teacher/sessoes/123")).toBe("/teacher/sessoes/123");
  });
  it("rejects hostile next, forbidden workspace, control loops and segment lookalikes", () => {
    for (const next of [
      "https://evil.test",
      "//evil.test",
      "/%2f%2fevil.test",
      "/%5cevil",
      "/%252f%252fevil",
      "/%00",
      "/admin",
      "/teacherXYZ",
      "/auth/continue",
      "/mfa",
    ]) {
      expect(authorizedNextPath(["STUDENT"], next)).toBeNull();
    }
    expect(authorizedNextPath(["STUDENT"], "/agenda?date=2026-10-02")).toBe(
      "/agenda?date=2026-10-02",
    );
    expect(authorizedNextPath(["STUDENT"], "/teacher/../admin")).toBeNull();
  });
  it("preserves recovery and continues through the server after MFA", () => {
    expect(resolveAuthDestination({ roles: ["STUDENT"], aal: "aal1" }, "/reset-password")).toBe(
      "/reset-password",
    );
    expect(authContinuePath("/teacher")).toBe("/auth/continue?next=%2Fteacher");
    expect(authContinuePath()).toBe("/auth/continue");
  });
});
