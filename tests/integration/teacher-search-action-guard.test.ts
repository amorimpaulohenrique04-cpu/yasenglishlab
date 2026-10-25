import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertRole: vi.fn(),
  loadTeacherSearchIndex: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.assertRole }));
vi.mock("@/server/teacher-operations/search-index", () => ({
  loadTeacherSearchIndex: mocks.loadTeacherSearchIndex,
}));

import { loadTeacherSearchIndexAction } from "@/app/(protected)/(teacher)/search-actions";

describe("loadTeacherSearchIndexAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-teacher or AAL1 sessions before touching the repository", async () => {
    mocks.assertRole.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(loadTeacherSearchIndexAction()).rejects.toThrow("FORBIDDEN");
    expect(mocks.assertRole).toHaveBeenCalledWith("TEACHER");
    expect(mocks.loadTeacherSearchIndex).not.toHaveBeenCalled();
  });

  it("returns the index for an authorized teacher", async () => {
    const index = { students: [], cohorts: [], reviews: [] };
    mocks.assertRole.mockResolvedValue({});
    mocks.loadTeacherSearchIndex.mockResolvedValue(index);
    await expect(loadTeacherSearchIndexAction()).resolves.toBe(index);
  });
});
