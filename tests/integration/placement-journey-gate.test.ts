import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  placement: vi.fn(),
  enrolled: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/assessments/assessments", () => ({}));
vi.mock("@/server/placement/placement", () => ({
  loadStudentPlacement: mocks.placement,
  loadStudentHasActiveCohortEnrollment: mocks.enrolled,
  saveCurrentPreferences: mocks.save,
}));
import {
  loadDecisionPending,
  loadPlacementJourney,
  requireDecisionConfirmed,
} from "@/server/placement/decision-gate";
import { savePreferencesAction } from "@/app/(protected)/(student)/onboarding/actions";

const view = (state: string) => ({ case: { id: "c", state } });
function availability(extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    timezone: "America/Recife",
    weekday: "3",
    start: "18:00",
    end: "21:00",
    ...extra,
  }))
    form.set(key, value);
  return form;
}

describe("placement journey gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enrolled.mockResolvedValue(false);
  });
  it("keeps the decision gate while the Student has no active cohort enrollment", async () => {
    mocks.placement.mockResolvedValue(view("STUDENT_DECISION"));
    expect((await loadPlacementJourney()).open).toBe(true);
    expect(await loadDecisionPending()).toBe(true);
    await expect(requireDecisionConfirmed()).rejects.toThrow("redirect:/home");
  });
  it("opens Home and pedagogic routes after an admin enrollment without rewriting the case", async () => {
    mocks.placement.mockResolvedValue(view("STUDENT_DECISION"));
    mocks.enrolled.mockResolvedValue(true);
    expect((await loadPlacementJourney()).open).toBe(false);
    expect(await loadDecisionPending()).toBe(false);
    await expect(requireDecisionConfirmed()).resolves.toBeUndefined();
  });
  it("does not query enrollments for an ENROLLED case or a Student without a case", async () => {
    mocks.placement.mockResolvedValue(view("ENROLLED"));
    expect((await loadPlacementJourney()).open).toBe(false);
    mocks.placement.mockResolvedValue(null);
    expect(await loadDecisionPending()).toBe(false);
    expect(mocks.enrolled).not.toHaveBeenCalled();
  });
  it("keeps the review state outside the decision gate", async () => {
    mocks.placement.mockResolvedValue(view("REVIEW_PENDING"));
    expect((await loadPlacementJourney()).open).toBe(true);
    expect(await loadDecisionPending()).toBe(false);
  });
});

describe("availability update from the cohort list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("saves and returns to the recalculated cohort list", async () => {
    mocks.save.mockResolvedValue("c");
    await expect(savePreferencesAction(availability({ returnTo: "placement" }))).rejects.toThrow(
      "redirect:/onboarding/placement?result=availability-saved",
    );
    expect(mocks.save).toHaveBeenCalledWith({
      timezone: "America/Recife",
      weekday: 3,
      startMinute: 1080,
      endMinute: 1260,
    });
  });
  it("rejects an invalid window on the same page without saving", async () => {
    await expect(
      savePreferencesAction(availability({ returnTo: "placement", end: "17:00" })),
    ).rejects.toThrow("redirect:/onboarding/placement?result=availability-invalid");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("keeps the onboarding destination when not coming from the cohort list", async () => {
    mocks.save.mockResolvedValue("c");
    await expect(savePreferencesAction(availability())).rejects.toThrow(
      "redirect:/onboarding?result=saved",
    );
    mocks.save.mockRejectedValue(new Error("db"));
    await expect(savePreferencesAction(availability({ returnTo: "placement" }))).rejects.toThrow(
      "redirect:/onboarding/placement?result=availability-error",
    );
  });
});
