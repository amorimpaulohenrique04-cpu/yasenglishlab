import { describe, expect, it } from "vitest";

import { normalizeSignedUrlTtl, sanitizeNextPath, staffMfaRequired } from "@/modules/auth";

describe("security contracts", () => {
  it("requires aal2 for every staff role", () => {
    expect(staffMfaRequired(["STUDENT"], "aal1")).toBe(false);
    expect(staffMfaRequired(["TEACHER"], "aal1")).toBe(true);
    expect(staffMfaRequired(["SUPPORT"], "aal1")).toBe(true);
    expect(staffMfaRequired(["ADMIN"], null)).toBe(true);
    expect(staffMfaRequired(["ADMIN"], "aal2")).toBe(false);
  });

  it("accepts only local relative redirect paths", () => {
    expect(sanitizeNextPath("/profile?tab=security")).toBe("/profile?tab=security");
    expect(sanitizeNextPath("https://evil.example")).toBe("/profile");
    expect(sanitizeNextPath("//evil.example/path")).toBe("/profile");
    expect(sanitizeNextPath("/\\evil")).toBe("/profile");
  });

  it("keeps protected signed URLs short lived", () => {
    expect(normalizeSignedUrlTtl(undefined)).toBe(120);
    expect(normalizeSignedUrlTtl(5)).toBe(30);
    expect(normalizeSignedUrlTtl(120)).toBe(120);
    expect(normalizeSignedUrlTtl(3600)).toBe(300);
  });
});
