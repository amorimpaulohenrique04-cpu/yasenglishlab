import { describe, expect, it } from "vitest";
import {
  draftFromDetail,
  enrollErrorMessage,
  enrollNextCourseInput,
  isoToRecifeLocal,
  itemsMissingParent,
  pathReducer,
  recifeLocalToIso,
  serializeDraft,
  type DraftPath,
} from "@/modules/admin-cohort-path/domain/models";

const a = "a1000000-0000-4000-8000-000000000001";
const b = "a1000000-0000-4000-8000-000000000002";
const c = "a1000000-0000-4000-8000-000000000003";
const empty: DraftPath = { mode: "CUSTOM", sequential: false, items: [] };

describe("cohort path reducer", () => {
  it("includes without duplicating and excludes", () => {
    let s = pathReducer(empty, {
      type: "include",
      entry: { contentKind: "modules", contentId: a },
    });
    s = pathReducer(s, { type: "include", entry: { contentKind: "modules", contentId: a } });
    expect(s.items).toHaveLength(1);
    s = pathReducer(s, { type: "exclude", contentKind: "modules", contentId: a });
    expect(s.items).toHaveLength(0);
  });
  it("moves items and ignores out-of-range moves", () => {
    let s = pathReducer(empty, {
      type: "include",
      entry: { contentKind: "modules", contentId: a },
    });
    s = pathReducer(s, { type: "include", entry: { contentKind: "lessons", contentId: b } });
    expect(pathReducer(s, { type: "move", index: 0, direction: -1 })).toBe(s);
    expect(pathReducer(s, { type: "move", index: 1, direction: 1 })).toBe(s);
    s = pathReducer(s, { type: "move", index: 1, direction: -1 });
    expect(s.items.map((i) => i.contentId)).toEqual([b, a]);
  });
});

describe("cohort path serialization", () => {
  it("converts Recife wall time to UTC and back", () => {
    expect(recifeLocalToIso("2026-10-15T09:30")).toBe("2026-10-15T12:30:00.000Z");
    expect(isoToRecifeLocal("2026-10-15T12:30:00.000Z")).toBe("2026-10-15T09:30");
    expect(recifeLocalToIso("garbage")).toBeNull();
    expect(isoToRecifeLocal(null)).toBe("");
  });
  it("assigns contiguous positions and null release dates", () => {
    const out = serializeDraft({
      mode: "CUSTOM",
      sequential: true,
      items: [
        { contentKind: "modules", contentId: a, availableFrom: "" },
        { contentKind: "lessons", contentId: b, availableFrom: "2026-10-15T09:30" },
      ],
    });
    expect(out.items.map((i) => i.position)).toEqual([0, 1]);
    expect(out.items[0]!.availableFrom).toBeNull();
    expect(out.items[1]!.availableFrom).toBe("2026-10-15T12:30:00.000Z");
  });
  it("sends no items in default mode and in copy mode", () => {
    const draft: DraftPath = {
      mode: "DEFAULT",
      sequential: false,
      items: [{ contentKind: "modules", contentId: a, availableFrom: "" }],
    };
    expect(serializeDraft(draft).items).toEqual([]);
    const copy = serializeDraft({ ...draft, mode: "CUSTOM" }, true);
    expect(copy).toMatchObject({ mode: "CUSTOM", copyFromCourse: true, items: [] });
  });
  it("rejects an invalid release date", () => {
    expect(() =>
      serializeDraft({
        ...empty,
        items: [{ contentKind: "modules", contentId: a, availableFrom: "31/12/2026" }],
      }),
    ).toThrow();
  });
  it("round-trips detail into a draft sorted by position", () => {
    const draft = draftFromDetail({
      cohortId: a,
      courseId: b,
      cohortName: "T",
      mode: "CUSTOM",
      sequential: true,
      updatedAt: null,
      catalog: [],
      items: [
        { contentKind: "lessons", contentId: c, position: 1, availableFrom: null },
        {
          contentKind: "modules",
          contentId: a,
          position: 0,
          availableFrom: "2026-10-15T12:30:00.000Z",
        },
      ],
    });
    expect(draft.items.map((i) => i.contentId)).toEqual([a, c]);
    expect(draft.items[0]!.availableFrom).toBe("2026-10-15T09:30");
  });
  it("detects items missing their parent", () => {
    const catalog = [
      {
        contentKind: "lessons" as const,
        contentId: b,
        title: "L",
        audience: "COURSE",
        parentKind: "modules",
        parentId: a,
        publicationStatus: "PUBLISHED",
        defaultIncluded: true,
      },
    ];
    const draft: DraftPath = {
      ...empty,
      items: [{ contentKind: "lessons", contentId: b, availableFrom: "" }],
    };
    expect(itemsMissingParent(draft, catalog)).toEqual([b]);
  });
});

describe("enrollment form validation", () => {
  it("requires a reason and strict fields", () => {
    expect(
      enrollNextCourseInput.safeParse({ userId: a, courseId: b, cohortId: c, reason: " " }).success,
    ).toBe(false);
    expect(
      enrollNextCourseInput.safeParse({ userId: a, courseId: b, cohortId: c, reason: "ok", x: 1 })
        .success,
    ).toBe(false);
    expect(
      enrollNextCourseInput.safeParse({ userId: a, courseId: b, cohortId: c, reason: " ok " }).data
        ?.reason,
    ).toBe("ok");
  });
  it("maps database errors to PT-BR without leaking raw text", () => {
    expect(enrollErrorMessage("cohort_capacity_exhausted")).toBe("A turma não tem mais vagas.");
    expect(enrollErrorMessage("Active compatible cohort required")).toContain("pertencer ao curso");
    expect(enrollErrorMessage("Target course is already completed")).toContain("já concluiu");
    expect(enrollErrorMessage("boom secret")).not.toContain("secret");
  });
});
