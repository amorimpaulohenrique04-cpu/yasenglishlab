import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), report: vi.fn() }));
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/server/observability/report", () => ({ reportTechnicalError: mocks.report }));
import { clientIp } from "@/server/security/client-ip";
import { rateLimit } from "@/server/security/rate-limit";

const h = (values: Record<string, string>) => ({ get: (n: string) => values[n] ?? null });

describe("clientIp", () => {
  it.each([
    [{ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "203.0.113.7"],
    [{ "x-forwarded-for": "2001:db8::1" }, "2001:db8::1"],
    [{ "x-real-ip": "198.51.100.2" }, "198.51.100.2"],
    [{ "x-forwarded-for": "garbage", "x-real-ip": "198.51.100.2" }, "198.51.100.2"],
    [{ "x-forwarded-for": "garbage" }, null],
    [{ "x-forwarded-for": "999.1.1.1" }, null],
    [{ "x-forwarded-for": "" }, null],
    [{}, null],
  ])("parses %j", (headers, expected) => {
    expect(clientIp(h(headers))).toBe(expected);
  });
});

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
    process.env.SUPABASE_PROTECTED_ASSETS_BUCKET = "assets";
  });
  const input = {
    bucket: "signup_email",
    subject: "Ana@Example.com",
    limit: 5,
    windowSeconds: 3600,
  };

  it("sends only an opaque 64-char hex key, never the subject", async () => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: true, hits: 1, limit: 5, retry_after_seconds: 0 },
      error: null,
    });
    await rateLimit(input);
    const args = mocks.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args).toLowerCase()).not.toContain("example.com");
  });
  it("blocks when allowed=false", async () => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: false, hits: 6, limit: 5, retry_after_seconds: 120 },
      error: null,
    });
    expect(await rateLimit(input)).toEqual({ allowed: false, retryAfterSeconds: 120 });
  });
  it.each([
    ["rpc error", { data: null, error: { code: "42501" } }],
    ["invalid payload", { data: { allowed: "yes" }, error: null }],
  ])("fails open on %s and reports without PII", async (_n, response) => {
    mocks.rpc.mockResolvedValue(response);
    expect((await rateLimit(input)).allowed).toBe(true);
    expect(JSON.stringify(mocks.report.mock.calls)).not.toContain("example.com");
    expect(mocks.report).toHaveBeenCalledOnce();
  });
  it("fails open when the RPC throws", async () => {
    mocks.rpc.mockRejectedValue(new Error("network"));
    expect((await rateLimit(input)).allowed).toBe(true);
  });
});
