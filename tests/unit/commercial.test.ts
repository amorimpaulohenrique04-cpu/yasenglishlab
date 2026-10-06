import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { checkoutPath, paymentState, signupSchema } from "@/modules/commercial/contracts";
import { fakeBillingAllowed, commercialProvider } from "@/server/commercial/provider";
import {
  registrationRetry,
  readRegistrationRetry,
  signupCallback,
} from "@/server/commercial/signup";
afterEach(() => vi.unstubAllEnvs());
describe("public commercial contracts", () => {
  it("validates signup and ignores browser role and arbitrary target", () => {
    const input = {
      name: "Aluno Yas",
      email: "aluno@example.test",
      password: "valid-password-123",
      confirmPassword: "valid-password-123",
      plan: "START",
      role: "ADMIN",
      userId: "victim",
    };
    expect(signupSchema.parse(input)).not.toHaveProperty("role");
    expect(signupSchema.parse(input)).not.toHaveProperty("userId");
    expect(signupSchema.safeParse({ ...input, password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...input, confirmPassword: "different" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...input, plan: "//evil.test" }).success).toBe(false);
    expect(checkoutPath("START")).toBe("/checkout?plan=START");
  });
  it("never treats a redirect as confirmation", () => {
    for (const state of ["CREATING", "READY"])
      expect(paymentState(state, null, null).kind).toBe("processing");
    expect(paymentState("PAID", null, null).kind).toBe("processing");
    expect(paymentState("PAID", "ACTIVE", null).kind).toBe("processing");
    expect(paymentState("PAID", "ACTIVE", "PAYMENT_CONFIRMED")).toEqual({
      kind: "confirmed",
      destination: "/onboarding",
    });
    expect(paymentState("PAID", "ACTIVE", "ENROLLED")).toEqual({
      kind: "confirmed",
      destination: "/home",
    });
    expect(paymentState("EXPIRED", null, null).kind).toBe("failed");
    expect(paymentState("CANCELLED", null, null).kind).toBe("failed");
  });
  it("fails closed in production, missing config and nonlocal fake config", () => {
    const local = {
      NODE_ENV: "test",
      BILLING_PROVIDER: "FAKE",
      CANONICAL_E2E: "1",
      APP_URL: "http://127.0.0.1:3000",
    };
    expect(fakeBillingAllowed(local)).toBe(true);
    for (const bad of [
      { ...local, NODE_ENV: "production" },
      { ...local, APP_URL: "https://example.test" },
      { ...local, CANONICAL_E2E: "0" },
      {},
    ])
      expect(fakeBillingAllowed(bad)).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_PROVIDER", "FAKE");
    expect(() => commercialProvider()).toThrow("unavailable");
    vi.stubEnv("BILLING_PROVIDER", "ASAAS");
    vi.stubEnv("ASAAS_ENVIRONMENT", undefined);
    expect(() => commercialProvider()).toThrow("unavailable");
  });
  it("signs a short-lived retry bound to the original signup identity", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-signing-secret");
    for (const name of [
      "APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PROTECTED_ASSETS_BUCKET",
    ])
      vi.stubEnv(name, name === "APP_URL" ? "http://127.0.0.1:3000" : "test");
    const id = "f44503a6-1b38-4e41-a5ad-d6c0e1f7b700";
    const token = registrationRetry(id, "START");
    expect(readRegistrationRetry(token)?.userId).toBe(id);
    expect(readRegistrationRetry(token.replace(/^./, "x"))).toBeNull();
    expect(readRegistrationRetry("forged")).toBeNull();
    expect(new URL(signupCallback("START")).searchParams.get("next")).toBe("/checkout?plan=START");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000000);
    expect(readRegistrationRetry(token)).toBeNull();
    vi.restoreAllMocks();
  });
});
