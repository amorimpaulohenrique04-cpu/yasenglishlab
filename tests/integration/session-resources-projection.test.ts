import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authenticated: vi.fn(), server: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({
  assertAuthenticated: mocks.authenticated,
  assertRole: vi.fn(),
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/server/assets/signed-url", () => ({ createProtectedAssetSignedUrl: vi.fn() }));
import { loadSessionResources } from "@/server/teacher-operations/resources";
const id = "89400000-0000-4000-8000-000000000001";
function authenticatedRows(data: unknown[]) {
  const query = {
    data,
    error: null,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  mocks.server.mockResolvedValue({ from: () => query });
  return query;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticated.mockResolvedValue({});
});
describe("Private session resource projection", () => {
  it("does not use privileged reads when authentication fails", async () => {
    mocks.authenticated.mockRejectedValue(new Error("Denied"));
    await expect(loadSessionResources(id)).rejects.toThrow("Denied");
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not query private paths when RLS returns no readable resources", async () => {
    authenticatedRows([]);
    expect(await loadSessionResources(id)).toEqual([]);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("checks only RLS-authorized IDs and returns a boolean instead of a storage path", async () => {
    authenticatedRows([
      { id, title: "Arquivo", material_id: null, practice_activity_id: null, external_url: null },
    ]);
    const privateQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi
        .fn()
        .mockResolvedValue({ data: [{ id, storage_path: "private/test-file.pdf" }], error: null }),
    };
    mocks.admin.mockReturnValue({ from: () => privateQuery });
    const resources = await loadSessionResources(id);
    expect(privateQuery.in).toHaveBeenCalledWith("id", [id]);
    expect(resources).toEqual([
      {
        id,
        title: "Arquivo",
        material_id: null,
        practice_activity_id: null,
        external_url: null,
        has_file: true,
      },
    ]);
    expect(JSON.stringify(resources)).not.toContain("storage_path");
    expect(JSON.stringify(resources)).not.toContain("private/test-file.pdf");
  });
});
