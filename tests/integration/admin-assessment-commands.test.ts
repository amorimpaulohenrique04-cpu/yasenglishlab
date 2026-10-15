import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.auth }));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/server/observability/context", () => ({
  getRequestTechnicalContext: vi.fn(async () => ({
    requestId: "a1000000-0000-4000-8000-000000000002",
    environment: "test",
    version: "12b",
  })),
}));
import {
  commandAdminAssessment,
  saveAdminAssessment,
} from "@/server/admin-assessments/admin-assessments";
const id = "a1000000-0000-4000-8000-000000000001";
describe("Assessment commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: id });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: { assessmentId: id, versionId: id }, error: null });
  });
  it("fails authorization before touching the database", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("denied"));
    await expect(commandAdminAssessment("publish", id, true)).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("makes entry selection explicit and forwards only technical context", async () => {
    await commandAdminAssessment("publish", id, true);
    expect(mocks.auth).toHaveBeenCalledWith("ADMIN");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_assessment_publish", {
      p_version_id: id,
      p_make_placement: true,
      p_context: {
        request_id: "a1000000-0000-4000-8000-000000000002",
        environment: "test",
        version: "12b",
      },
    });
  });
  it("cannot route a browser-supplied privileged field through draft saving", async () => {
    await expect(
      saveAdminAssessment(null, null, { title: "x", purpose: "x", is_placement: true }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not echo raw SQL errors or private data to the browser", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "private key material", code: "23514" },
    });
    await expect(commandAdminAssessment("retire", id)).rejects.toThrow(
      "Não foi possível concluir a alteração da avaliação.",
    );
  });
  it("routes new-version creation to the assessment, not a browser-selected version", async () => {
    await commandAdminAssessment("new_version", id);
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_assessment_id: id });
    expect(mocks.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_version_id");
  });
});
