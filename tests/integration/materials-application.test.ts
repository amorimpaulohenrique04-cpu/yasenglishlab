import { describe, expect, it, vi } from "vitest";

import {
  getMaterialsView,
  setMaterialFavorite,
  trackMaterialOpened,
  type MaterialListItem,
  type MaterialsAnalyticsPort,
  type MaterialsRepository,
} from "@/modules/materials";

const material: MaterialListItem = {
  id: "81710000-0000-4000-8000-000000000001",
  title: "Welcome Summary",
  materialType: "SUMMARY",
  metadata: { pages: 8 },
  module: {
    id: "41000000-0000-4000-8000-000000000001",
    position: 1,
    title: "Getting Started",
  },
  lesson: {
    id: "42000000-0000-4000-8000-000000000001",
    position: 1,
    title: "Welcome to Yas",
  },
  favorite: false,
};

function makeRepository(): MaterialsRepository {
  let favorite = false;

  return {
    listAuthorizedMaterials: vi.fn(async () => [{ ...material, favorite }]),
    getAuthorizedMaterial: vi.fn(async (_userId, materialId) =>
      materialId === material.id ? { ...material, favorite } : null,
    ),
    setFavorite: vi.fn(async (_userId, materialId, favorited) => {
      if (materialId !== material.id) throw new Error("not authorized");
      const changed = favorite !== favorited;
      favorite = favorited;
      return { favorited, changed };
    }),
  };
}

function makeAnalytics(): MaterialsAnalyticsPort {
  return { track: vi.fn(async () => undefined) };
}

describe("materials application", () => {
  it("fails closed for non-student roles", async () => {
    const state = await getMaterialsView(makeRepository(), "user-1", false, {});
    expect(state).toEqual({ status: "unauthorized" });
  });

  it("returns deterministic authorized search results", async () => {
    const state = await getMaterialsView(makeRepository(), "user-1", true, {
      query: "welcome",
      type: "SUMMARY",
    });

    expect(state.status).toBe("success");
    if (state.status !== "success") return;

    expect(state.data.materials.map((item) => item.id)).toEqual([material.id]);
    expect(state.data.groups[0]?.items[0]?.title).toBe("Welcome Summary");
  });

  it("favorites idempotently and emits analytics only for a real favorite transition", async () => {
    const repository = makeRepository();
    const analytics = makeAnalytics();

    await setMaterialFavorite(repository, analytics, "user-1", {
      materialId: material.id,
      favorited: true,
    });
    await setMaterialFavorite(repository, analytics, "user-1", {
      materialId: material.id,
      favorited: true,
    });

    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith({
      event: "material_favorited",
      properties: { material_id: material.id },
    });
  });

  it("tracks an authorized open with minimized material properties", async () => {
    const analytics = makeAnalytics();
    await trackMaterialOpened(analytics, material);

    expect(analytics.track).toHaveBeenCalledWith({
      event: "material_opened",
      properties: {
        material_id: material.id,
        material_type: "SUMMARY",
      },
    });
  });
});
