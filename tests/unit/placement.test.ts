import { describe, expect, it } from "vitest";
import {
  canTransition,
  placementStates,
  filterCandidates,
  preferenceSchema,
  reviewInputSchema,
  choiceInputSchema,
  transferInputSchema,
  type PlacementCandidate,
} from "@/modules/placement";
const courseId = "40000000-0000-4000-8000-000000000001";
const id = "99000000-0000-4000-8000-000000000001";
const preference = { timezone: "America/Recife", weekday: 1, startMinute: 1080, endMinute: 1260 };
const candidate: PlacementCandidate = {
  id,
  name: "Monday",
  courseId,
  timezone: "America/Recife",
  schedule: [{ weekday: 1, startMinute: 1140, endMinute: 1200 }],
  capacity: 6,
  occupancy: 5,
  startsAt: "2026-10-01T00:00:00Z",
};
describe("initial Placement contract", () => {
  it("accepts only adjacent transitions and no transition after enrollment", () => {
    for (const from of placementStates)
      for (const to of placementStates)
        expect(canTransition(from, to)).toBe(
          placementStates.indexOf(to) === placementStates.indexOf(from) + 1,
        );
    expect(canTransition("ENROLLED", "PAYMENT_CONFIRMED")).toBe(false);
  });
  it("requires exact recommended course, every recurring window, timezone and free capacity", () => {
    const rejected = [
      { ...candidate, id: "99000000-0000-4000-8000-000000000002", courseId: id },
      { ...candidate, occupancy: 6 },
      { ...candidate, timezone: "Europe/London" },
      {
        ...candidate,
        schedule: [...candidate.schedule, { weekday: 2, startMinute: 1140, endMinute: 1200 }],
      },
    ];
    expect(filterCandidates([...rejected, candidate], courseId, [preference])).toEqual([candidate]);
    expect(filterCandidates([candidate], courseId, [{ ...preference, endMinute: 1199 }])).toEqual(
      [],
    );
  });
  it("ranks deterministically without mutating inputs", () => {
    const second = { ...candidate, id: "99000000-0000-4000-8000-000000000002" };
    const source = [second, candidate];
    expect(filterCandidates(source, courseId, [preference])).toEqual([candidate, second]);
    expect(source).toEqual([second, candidate]);
  });
  it("rejects malformed schedule, authority fields and unapproved review taxonomy", () => {
    expect(preferenceSchema.safeParse({ ...preference, endMinute: 1080 }).success).toBe(false);
    expect(preferenceSchema.safeParse({ ...preference, timezone: "made/up" }).success).toBe(false);
    expect(
      choiceInputSchema.safeParse({
        cohortId: id,
        user_id: id,
        capacity: 6,
        recommended_track: courseId,
        status: "ENROLLED",
      }).success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({ caseId: id, courseId, feedback: " ", confidence: "HIGH" })
        .success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({ caseId: id, courseId, feedback: "Evidence", confidence: "B2" })
        .success,
    ).toBe(false);
    expect(
      transferInputSchema.safeParse({ caseId: id, cohortId: id, operationId: id, reason: "" })
        .success,
    ).toBe(false);
  });
});
