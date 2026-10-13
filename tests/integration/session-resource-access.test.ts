import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const {
  assertAuthenticated,
  userSingle,
  adminSingle,
  createSignedUrl,
  userFrom,
  adminFrom,
  adminStorageFrom,
} = vi.hoisted(() => ({
  assertAuthenticated: vi.fn(),
  userSingle: vi.fn(),
  adminSingle: vi.fn(),
  createSignedUrl: vi.fn(),
  userFrom: vi.fn(),
  adminFrom: vi.fn(),
  adminStorageFrom: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({ assertAuthenticated, assertRole: vi.fn() }));
vi.mock("@/server/assets/signed-url", () => ({ createProtectedAssetSignedUrl: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: userFrom }),
}));
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: adminFrom, storage: { from: adminStorageFrom } }),
}));
import { getSessionResourceAccess } from "@/server/teacher-operations/resources";

const ID = "9d400000-0000-4000-8000-0000000000aa";
const chain = (single: typeof userSingle) => {
  const q = { select: () => q, eq: () => q, single };
  return q;
};

describe("getSessionResourceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertAuthenticated.mockResolvedValue({});
    userFrom.mockReturnValue(chain(userSingle));
    adminFrom.mockReturnValue(chain(adminSingle));
    adminStorageFrom.mockReturnValue({ createSignedUrl });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://s/x" }, error: null });
  });
  it("rejects anonymous users before touching any client", async () => {
    assertAuthenticated.mockRejectedValue(new Error("UNAUTHENTICATED"));
    await expect(getSessionResourceAccess(ID)).rejects.toThrow();
    expect(userFrom).not.toHaveBeenCalled();
    expect(adminFrom).not.toHaveBeenCalled();
  });
  it.each([
    ["empty RLS result", { data: null, error: null }],
    ["RLS error", { data: null, error: { message: "denied" } }],
  ])("signs nothing when student has no access (%s)", async (_n, result) => {
    userSingle.mockResolvedValue(result);
    await expect(getSessionResourceAccess(ID)).rejects.toThrow("Recurso indisponível.");
    expect(userFrom).toHaveBeenCalledWith("live_session_resources");
    expect(adminFrom).not.toHaveBeenCalled();
    expect(adminStorageFrom).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
  it("signs the stored path for 300s only after the user-client read succeeds", async () => {
    userSingle.mockResolvedValue({
      data: { id: ID, material_id: null, practice_activity_id: null, external_url: null },
      error: null,
    });
    adminSingle.mockResolvedValue({ data: { storage_path: "sessions/s1/file.pdf" }, error: null });
    await expect(getSessionResourceAccess(ID)).resolves.toBe("https://s/x");
    expect(userFrom).toHaveBeenCalledTimes(1);
    expect(adminStorageFrom).toHaveBeenCalledWith("yas-session-resources");
    expect(createSignedUrl).toHaveBeenCalledWith("sessions/s1/file.pdf", 300);
  });
  it("rejects a non-UUID id before any query", async () => {
    await expect(getSessionResourceAccess("../../x")).rejects.toThrow();
    expect(userFrom).not.toHaveBeenCalled();
  });
});
