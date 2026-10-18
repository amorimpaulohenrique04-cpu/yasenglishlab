import { describe, expect, it } from "vitest";
import {
  canEditPreferences,
  canTransition,
  placementJourneyOpen,
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
  occupancy: 5,
  startsAt: "2026-10-01T00:00:00Z",
};
describe("initial Placement contract", () => {
  it("keeps availability editable until enrollment, matching save_placement_preferences", () => {
    for (const state of placementStates)
      expect(canEditPreferences(state)).toBe(state !== "ENROLLED");
  });
  it("closes the journey on ENROLLED or on an active cohort enrollment made outside Placement", () => {
    for (const state of placementStates) {
      expect(placementJourneyOpen(state, true)).toBe(false);
      expect(placementJourneyOpen(state, false)).toBe(state !== "ENROLLED");
    }
  });
  it("accepts only adjacent transitions and no transition after enrollment", () => {
    for (const from of placementStates)
      for (const to of placementStates)
        expect(canTransition(from, to)).toBe(
          placementStates.indexOf(to) === placementStates.indexOf(from) + 1,
        );
    expect(canTransition("ENROLLED", "PAYMENT_CONFIRMED")).toBe(false);
  });
  it("requires exact recommended course, every recurring window and the same instants", () => {
    const rejected = [
      { ...candidate, id: "99000000-0000-4000-8000-000000000002", courseId: id },
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
  it("compares instants across timezones, including daylight saving", () => {
    const london = {
      ...candidate,
      timezone: "Europe/London",
      schedule: [{ weekday: 1, startMinute: 1320, endMinute: 1380 }],
    };
    // 22:00 London is 18:00 in Recife while London is on BST (UTC+1), and 19:00 after the clocks change.
    const october = new Date("2026-10-15T12:00:00Z");
    const november = new Date("2026-11-02T12:00:00Z");
    expect(
      filterCandidates(
        [london],
        courseId,
        [{ ...preference, startMinute: 1080, endMinute: 1140 }],
        october,
      ),
    ).toEqual([london]);
    expect(
      filterCandidates(
        [london],
        courseId,
        [{ ...preference, startMinute: 1080, endMinute: 1140 }],
        november,
      ),
    ).toEqual([]);
    expect(
      filterCandidates(
        [london],
        courseId,
        [{ ...preference, startMinute: 1140, endMinute: 1200 }],
        november,
      ),
    ).toEqual([london]);
  });
  it("matches a window that lands on another weekday in the student's timezone", () => {
    const late = { ...candidate, schedule: [{ weekday: 1, startMinute: 1380, endMinute: 1440 }] };
    const sydney = { timezone: "Australia/Sydney", weekday: 2, startMinute: 780, endMinute: 900 };
    expect(filterCandidates([late], courseId, [sydney], new Date("2026-10-15T12:00:00Z"))).toEqual([
      late,
    ]);
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
