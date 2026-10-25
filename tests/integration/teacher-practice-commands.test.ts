import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  assertRole: vi.fn(),
  createServer: vi.fn(),
  createAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/auth/guards", () => ({
  assertRole: mocks.assertRole,
  assertAuthenticated: vi.fn(),
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.createServer }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/server/observability/context", () => ({
  getRequestTechnicalContext: async () => ({
    requestId: "55555555-5555-4555-8555-555555555555",
    environment: "test",
    version: "v",
  }),
}));
vi.mock("@/server/observability/trace", () => ({
  withObservedSpan: async (_input: unknown, op: (c: unknown) => Promise<unknown>) => op({}),
}));

import {
  PracticeAuthoringError,
  assignTeacherPractice,
  finalizeTeacherPracticeReview,
  getTeacherPractice,
  listTeacherPractices,
  mapPracticeAuthoringError,
  publishTeacherPractice,
  reserveTeacherPracticeAsset,
  saveTeacherPractice,
} from "@/server/teacher-operations/practice-commands";

const practiceId = "66666666-6666-4666-8666-666666666666";
const courseId = "77777777-7777-4777-8777-777777777777";
const cohortId = "88888888-8888-4888-8888-888888888888";

const draft = {
  id: null,
  title: "Past simple",
  skill: "GRAMMAR",
  estimatedMinutes: 10,
  courseId,
  content: {
    stimulus: { type: "NONE" },
    prompt: "Choose",
    response: {
      type: "CHOICE_SINGLE",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    },
  },
  answerKey: { optionId: "a" },
  feedback: { correct: "Great" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertRole.mockResolvedValue({ userId: "99999999-9999-4999-8999-999999999999" });
  mocks.createServer.mockResolvedValue({ rpc: mocks.rpc });
});

describe("teacher practice commands", () => {
  it("uses the user JWT client (never service role) and forwards a technical context", async () => {
    mocks.rpc.mockResolvedValue({ data: practiceId, error: null });
    await expect(saveTeacherPractice(draft)).resolves.toBe(practiceId);

    expect(mocks.assertRole).toHaveBeenCalledWith("TEACHER");
    expect(mocks.createServer).toHaveBeenCalledTimes(1);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    const [name, args] = mocks.rpc.mock.calls[0]!;
    expect(name).toBe("teacher_practice_save");
    expect(args.p_id).toBeNull();
    expect(args.p_answer_key).toEqual({ optionId: "a" });
    expect(args.p_payload.content.version).toBe(2);
    expect(args.p_payload.course_id).toBe(courseId);
    expect(args.p_context).toEqual({
      request_id: "55555555-5555-4555-8555-555555555555",
      environment: "test",
      version: "v",
    });
  });

  it("rejects malformed input before reaching the database", async () => {
    await expect(saveTeacherPractice({ ...draft, extra: true })).rejects.toBeTruthy();
    await expect(saveTeacherPractice({ ...draft, courseId: "nope" })).rejects.toBeTruthy();
    await expect(
      assignTeacherPractice({ practiceId, cohortIds: [], dueAt: null }),
    ).rejects.toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps 42501 to FORBIDDEN and 23514/22023 to INVALID without leaking SQL", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: 'new row violates row-level security policy for table "x"' },
    });
    await expect(publishTeacherPractice(practiceId)).rejects.toMatchObject({ code: "FORBIDDEN" });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "Matching private answer key required" },
    });
    const invalid = await publishTeacherPractice(practiceId).catch((e: unknown) => e);
    expect(invalid).toBeInstanceOf(PracticeAuthoringError);
    expect(invalid).toMatchObject({ code: "INVALID" });
    expect((invalid as Error).message).toMatch(/gabarito/);
    expect((invalid as Error).message).not.toMatch(/Matching private/);

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "22023", message: 'Unsupported practice field "foo" relation public.x' },
    });
    const generic = await publishTeacherPractice(practiceId).catch((e: unknown) => e);
    expect(generic).toMatchObject({ code: "INVALID" });
    expect((generic as Error).message).not.toMatch(/relation|public\./);

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(publishTeacherPractice(practiceId)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("maps domain rules to PT-BR messages", () => {
    expect(
      mapPracticeAuthoringError({
        code: "23514",
        message: "Practice has attempts: duplicate it to edit",
      }).message,
    ).toMatch(/duplique/);
  });

  it("parses list and detail payloads and rejects unexpected shapes", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: practiceId,
          title: "t",
          skill: "WRITING",
          estimatedMinutes: 5,
          cefrTarget: null,
          courseId,
          courseTitle: "C",
          publicationStatus: "DRAFT",
          publishedAt: null,
          responseType: "WRITTEN",
          stimulusType: "NONE",
          hasAttempts: false,
          assignmentCount: 0,
          updatedAt: "2026-10-15T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(listTeacherPractices()).resolves.toHaveLength(1);

    mocks.rpc.mockResolvedValueOnce({ data: { id: practiceId }, error: null });
    await expect(getTeacherPractice(practiceId)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("assign sends an ISO deadline and distinct cohort ids; reserve validates MIME per type", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 1, error: null });
    await expect(
      assignTeacherPractice({
        practiceId,
        cohortIds: [cohortId],
        dueAt: "2030-01-01T12:00:00-03:00",
        availableFrom: "2029-12-30T12:00:00-03:00",
        requireLessonAvailable: true,
      }),
    ).resolves.toBe(1);
    expect(mocks.rpc.mock.calls[0]![1]).toMatchObject({
      p_id: practiceId,
      p_cohort_ids: [cohortId],
      p_due_at: "2030-01-01T12:00:00-03:00",
      p_available_from: "2029-12-30T12:00:00-03:00",
      p_require_lesson_available: true,
    });

    await expect(
      reserveTeacherPracticeAsset({ practiceId, assetType: "IMAGE", mime: "audio/webm" }),
    ).rejects.toBeTruthy();
    mocks.rpc.mockResolvedValueOnce({
      data: {
        assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        bucket: "yas-practice-assets",
        storagePath: `${practiceId}/x`,
        maxBytes: 26214400,
      },
      error: null,
    });
    await expect(
      reserveTeacherPracticeAsset({ practiceId, assetType: "AUDIO", mime: "audio/webm" }),
    ).resolves.toMatchObject({ bucket: "yas-practice-assets" });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("does not touch the database when the role guard rejects", async () => {
    mocks.assertRole.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(listTeacherPractices()).rejects.toThrow("FORBIDDEN");
    expect(mocks.createServer).not.toHaveBeenCalled();
  });
});

describe("teacher practice server actions", () => {
  it("reject non-teachers before touching commands and redirect with save=error on failures", async () => {
    const commands = await import("@/server/teacher-operations/practice-commands");
    const actions = await import("@/app/(protected)/(teacher)/teacher/praticas/actions");

    mocks.assertRole.mockRejectedValue(new Error("FORBIDDEN"));
    const form = new FormData();
    form.set("id", practiceId);
    for (const run of [
      () => actions.savePracticeAction(form),
      () => actions.publishPracticeAction(form),
      () => actions.unpublishPracticeAction(form),
      () => actions.duplicatePracticeAction(form),
      () => actions.assignPracticeAction(form),
      () => actions.unassignPracticeAction(form),
      () => actions.reservePracticeAssetAction(practiceId, "IMAGE", "image/png"),
      () => actions.completePracticeAssetAction(practiceId, practiceId),
    ]) {
      await expect(run()).rejects.toThrow("FORBIDDEN");
    }
    expect(mocks.assertRole).toHaveBeenCalledWith("TEACHER");
    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(commands).toBeTruthy();

    mocks.assertRole.mockResolvedValue({ userId: "99999999-9999-4999-8999-999999999999" });
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "Invalid publication transition" },
    });
    await expect(actions.publishPracticeAction(form)).rejects.toThrow(
      `REDIRECT:/teacher/praticas/${practiceId}?save=error&reason=INVALID`,
    );
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(actions.publishPracticeAction(form)).rejects.toThrow(
      `REDIRECT:/teacher/praticas/${practiceId}?save=success`,
    );
  });
});

describe("teacher practice v3 commands", () => {
  const v3Draft = {
    ...draft,
    answerKey: undefined,
    feedback: undefined,
    content: {
      version: 3,
      objective: "usar o passado",
      askConfidence: true,
      items: [
        {
          id: "q-1",
          prompt: "Choose",
          stimulus: { type: "NONE" },
          response: draft.content.response,
        },
      ],
    },
    itemKeys: { "q-1": { answerKey: { optionId: "a" }, feedback: { correct: "Ok" } } },
  };

  it("saves through teacher_practice_save_v3 with item keys", async () => {
    mocks.rpc.mockResolvedValue({ data: practiceId, error: null });
    await expect(saveTeacherPractice(v3Draft)).resolves.toBe(practiceId);
    const [name, args] = mocks.rpc.mock.calls[0]!;
    expect(name).toBe("teacher_practice_save_v3");
    expect(args.p_payload.content.version).toBe(3);
    expect(args.p_item_keys["q-1"].answerKey).toEqual({ optionId: "a" });
    expect(args).not.toHaveProperty("p_answer_key");
  });

  it("calls the finalize_practice_review overload only when an item id is given", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const input = {
      attemptId: practiceId,
      ratings: { task_completion: "SOLID" as const },
      feedback: "Bom",
    };
    await finalizeTeacherPracticeReview({ ...input, itemId: "q-2" });
    await finalizeTeacherPracticeReview(input);
    expect(mocks.rpc.mock.calls[0]![1].p_item_id).toBe("q-2");
    expect(mocks.rpc.mock.calls[1]![1]).not.toHaveProperty("p_item_id");
  });
});
