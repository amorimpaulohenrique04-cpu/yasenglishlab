import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rate: vi.fn(),
  headers: vi.fn(),
  register: vi.fn(),
  server: vi.fn(),
  resetPassword: vi.fn(),
}));
class Redirect extends Error {
  constructor(public url: string) {
    super("redirect");
  }
}
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/server/security/rate-limit", async () => ({
  ...(await vi.importActual<typeof import("@/server/security/client-ip")>(
    "@/server/security/client-ip",
  )),
  rateLimit: mocks.rate,
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/server/commercial/signup", () => ({
  registerStudent: mocks.register,
  ensurePublicStudentRole: vi.fn(),
  readRegistrationRetry: vi.fn(),
}));
vi.mock("@/server/commercial/plans", () => ({ selectedPlan: vi.fn() }));
vi.mock("@/server/env", () => ({
  getServerSupabaseEnvironment: () => ({ appUrl: "http://localhost:3000" }),
}));
import { signupAction } from "@/app/(auth)/signup/actions";
import { requestPasswordResetAction } from "@/app/(auth)/forgot-password/actions";

const hdrs = (ip?: string) => ({
  get: (n: string) => (n === "x-forwarded-for" ? (ip ?? null) : null),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(hdrs("203.0.113.9"));
  mocks.server.mockResolvedValue({ auth: { resetPasswordForEmail: mocks.resetPassword } });
});

describe("signup rate limit", () => {
  it("returns rate_limited without registering", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });
    const form = new FormData();
    form.set("email", "  Ana@Example.com ");
    expect(await signupAction({ status: "initial" }, form)).toEqual({ status: "rate_limited" });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "signup_ip", limit: 10, windowSeconds: 3600 }),
    );
  });
  it("skips the IP bucket when the IP is unknown and normalizes the e-mail", async () => {
    mocks.headers.mockResolvedValue(hdrs());
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });
    const form = new FormData();
    form.set("email", "  Ana@Example.com ");
    await signupAction({ status: "initial" }, form);
    expect(mocks.rate).toHaveBeenCalledTimes(1);
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "signup_email", subject: "ana@example.com", limit: 5 }),
    );
  });
});

describe("forgot-password rate limit", () => {
  const run = async (email: string) => {
    const form = new FormData();
    form.set("email", email);
    try {
      await requestPasswordResetAction(form);
    } catch (error) {
      return (error as Redirect).url;
    }
    return null;
  };
  it("returns the same generic result and sends nothing when limited", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 10 });
    expect(await run("ana@example.com")).toBe("/forgot-password?sent=1");
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
  it("sends and returns the identical result when allowed", async () => {
    mocks.rate.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    expect(await run("ana@example.com")).toBe("/forgot-password?sent=1");
    expect(mocks.resetPassword).toHaveBeenCalledOnce();
  });
});
