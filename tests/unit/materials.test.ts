import { describe, expect, it } from "vitest";

import {
  filterMaterials,
  groupMaterialsByModule,
  normalizeMaterialsFilters,
  sortMaterials,
  type MaterialListItem,
} from "@/modules/materials";

const materials: MaterialListItem[] = [
  {
    id: "81710000-0000-4000-8000-000000000002",
    title: "Natural Introductions Vocabulary",
    materialType: "VOCABULARY",
    metadata: { words: 24 },
    module: { id: "m1", position: 1, title: "Getting Started" },
    lesson: { id: "l2", position: 2, title: "Introductions that sound natural" },
    favorite: true,
  },
  {
    id: "81710000-0000-4000-8000-000000000001",
    title: "Welcome Summary",
    materialType: "SUMMARY",
    metadata: { pages: 8 },
    module: { id: "m1", position: 1, title: "Getting Started" },
    lesson: { id: "l1", position: 1, title: "Welcome to Yas" },
    favorite: false,
  },
];

describe("materials domain", () => {
  it("normalizes filters without accepting unsupported categories", () => {
    expect(normalizeMaterialsFilters({ query: "  welcome  ", type: "SUMMARY" })).toEqual({
      query: "welcome",
      type: "SUMMARY",
    });
    expect(normalizeMaterialsFilters({ query: "", type: "PRIVATE" })).toEqual({
      query: "",
      type: "ALL",
    });
  });

  it("sorts deterministically by module, lesson, type and title", () => {
    expect(sortMaterials(materials).map((item) => item.id)).toEqual([
      "81710000-0000-4000-8000-000000000001",
      "81710000-0000-4000-8000-000000000002",
    ]);
  });

  it("searches title and pedagogical context with accent-insensitive matching", () => {
    expect(
      filterMaterials(materials, { query: "vocabulario", type: "ALL" }).map((item) => item.id),
    ).toEqual(["81710000-0000-4000-8000-000000000002"]);

    expect(
      filterMaterials(materials, { query: "welcome", type: "SUMMARY" }).map((item) => item.id),
    ).toEqual(["81710000-0000-4000-8000-000000000001"]);
  });

  it("groups by module without inventing a recents model", () => {
    const groups = groupMaterialsByModule(materials);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe("Módulo 1 · Getting Started");
    expect(groups[0]?.items).toHaveLength(2);
  });
});
