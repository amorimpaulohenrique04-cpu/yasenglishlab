import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { unwrap, maybeSingle, rpc } = vi.hoisted(() => ({
  unwrap: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/server/media/mux-provider", () => ({
  muxClient: () => ({ webhooks: { unwrap } }),
  muxWebhookSecret: () => "secret",
}));
vi.mock("@/server/supabase/admin", () => {
  const query = { select: () => query, eq: () => query, maybeSingle };
  return { createSupabaseAdminClient: () => ({ from: () => query, rpc }) };
});
import { POST } from "@/app/api/webhooks/mux/route";

const req = (body = "{}", headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/webhooks/mux", { method: "POST", body, headers });
const event = (created_at: string) => ({
  id: "evt",
  type: "video.asset.ready",
  created_at,
  data: { id: "asset" },
});

describe("Mux webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrap.mockResolvedValue(event(new Date().toISOString()));
    maybeSingle.mockResolvedValue({ data: { id: "v1" }, error: null });
    rpc.mockResolvedValue({ data: "APPLIED", error: null });
  });
  it("rejects bodies over 1 MiB without content-length", async () => {
    const chunk = new Uint8Array(512 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 4) c.enqueue(chunk);
        else c.close();
      },
    });
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await POST(request)).status).toBe(413);
    expect(unwrap).not.toHaveBeenCalled();
  });
  it("returns 401 on invalid signature", async () => {
    unwrap.mockRejectedValue(new Error("bad"));
    expect((await POST(req())).status).toBe(401);
  });
  it("returns 503 on database error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "db" } });
    expect((await POST(req())).status).toBe(503);
  });
  it("returns 503 for unknown recent asset", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(req())).status).toBe(503);
  });
  it("returns 204 for unknown asset older than 24h", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    unwrap.mockResolvedValue(event(new Date(Date.now() - 25 * 3600_000).toISOString()));
    expect((await POST(req())).status).toBe(204);
  });
  it("returns 204 on success", async () => {
    expect((await POST(req())).status).toBe(204);
  });
  it("returns 503 when processing is PENDING", async () => {
    rpc.mockResolvedValue({ data: "PENDING", error: null });
    expect((await POST(req())).status).toBe(503);
  });
});
