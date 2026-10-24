import { describe, expect, it } from "vitest";
import {
  classifyEntryRpcError,
  computeEntryNeighbors,
  entryAdjacentNeeds,
  entryEvidenceResponseSchema,
  entryFiltersSchema,
  entryUrl,
} from "@/modules/placement/domain/entry-workspace";

describe("Entry workspace", () => {
  it("loads a human-reviewed response with no answer key", () => {
    // Regression: the database returns null, not undefined, for manual answer keys.
    expect(
      entryEvidenceResponseSchema.parse({
        skill: "SPEAKING",
        prompt: { prompt: "Daily routine" },
        response: { text: "I study." },
        rubric: null,
        answerKey: null,
        score: null,
      }).answerKey,
    ).toBeNull();
  });
  it("preserves queue context and safely defaults malformed filters", () => {
    const filters = entryFiltersSchema.parse({
      page: "-2",
      status: "unknown",
      order: "newest",
      q: "Ana & Bruno",
      cohort: "",
    });
    expect(filters.page).toBe(1);
    expect(filters.status).toBe("active");
    expect(entryUrl(filters)).toBe("/teacher/revisoes/placement?q=Ana+%26+Bruno&order=newest");
  });
});

describe("Entry neighbors", () => {
  const ids = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => ({ id: `c${from + i}` }));
  const page = (items: { id: string }[], p: number) => ({
    items,
    total: 45,
    pageSize: 20,
    page: p,
  });

  it("derives position, prev and next from a single page", () => {
    const n = computeEntryNeighbors(page(ids(20, 20), 2), "c25");
    expect(n).toMatchObject({ prev: "c24", next: "c26", position: 26, total: 45 });
    expect(entryAdjacentNeeds(page(ids(20, 20), 2), "c25")).toMatchObject({
      prev: false,
      next: false,
    });
  });
  it("uses adjacent pages only at the edges", () => {
    const q = page(ids(20, 20), 2);
    expect(entryAdjacentNeeds(q, "c20").prev).toBe(true);
    expect(entryAdjacentNeeds(q, "c39").next).toBe(true);
    const n = computeEntryNeighbors(q, "c39", { nextFirstId: "c40" });
    expect(n).toMatchObject({ next: "c40", nextPage: 3, position: 40 });
  });
  it("falls back gracefully when the case is not in the list", () => {
    expect(computeEntryNeighbors(page(ids(3), 1), "zzz")).toMatchObject({
      prev: null,
      next: "c0",
      position: null,
      total: 45,
    });
  });
});

describe("Entry RPC errors", () => {
  it("maps database errors to specific codes", () => {
    expect(classifyEntryRpcError({ code: "40001" })).toBe("conflict");
    expect(classifyEntryRpcError({ code: "42501" })).toBe("forbidden");
    expect(classifyEntryRpcError({ code: "23514", message: "Review already finalized" })).toBe(
      "finalized",
    );
    expect(classifyEntryRpcError({ code: "23514", message: "Published course required" })).toBe(
      "validation",
    );
    expect(classifyEntryRpcError({ code: "XX000" })).toBe("unknown");
  });
  it("accepts completed_today in the URL", () => {
    expect(entryFiltersSchema.parse({ status: "completed_today" }).status).toBe("completed_today");
  });
});
