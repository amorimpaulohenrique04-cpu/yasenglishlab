import { describe, expect, it } from "vitest";
import {
  manualMeetingUrlSchema,
  teacherSessionInputSchema,
} from "@/modules/teacher-operations/domain/session-input";
import { playbackTtl } from "@/modules/learning/application/video-provider";
import { submitPracticeInputSchema } from "@/modules/practice/application/commands";
import { parsePracticeContent } from "@/modules/practice/domain/models";
describe("Core experience boundaries", () => {
  it("rejects non-HTTPS, credentials, oversized URLs and control characters", () => {
    for (const value of [
      "http://meet.example.test",
      "https://user:password@meet.example.test",
      "https://meet.example.test/\nsecret",
      "https://meet.example.test/" + "a".repeat(2048),
    ])
      expect(manualMeetingUrlSchema.safeParse(value).success).toBe(false);
    expect(manualMeetingUrlSchema.parse("https://meet.example.test/room?token=test")).toBe(
      "https://meet.example.test/room?token=test",
    );
  });
  it("rejects browser authority and reversed intervals", () => {
    const input = {
      title: "Session",
      session_type: "CORE_CLASS",
      starts_at: "2030-01-01T10:00:00Z",
      ends_at: "2030-01-01T11:00:00Z",
      capacity: 6,
      cohort_id: null,
      target_student_user_id: null,
    };
    expect(teacherSessionInputSchema.safeParse({ ...input, teacher_id: "123" }).success).toBe(
      false,
    );
    expect(
      teacherSessionInputSchema.safeParse({ ...input, ends_at: "2030-01-01T09:00:00Z" }).success,
    ).toBe(false);
  });
  it("keeps text responses while declaring audio explicitly", () => {
    expect(
      parsePracticeContent({
        kind: "MANUAL_AUDIO",
        evaluationMode: "MANUAL_PENDING",
        prompt: "Speak",
        instructions: "Record",
      }).kind,
    ).toBe("MANUAL_AUDIO");
    const attemptId = "42000000-0000-4000-8000-000000000001";
    expect(submitPracticeInputSchema.safeParse({ attemptId, mediaId: attemptId }).success).toBe(
      true,
    );
    expect(
      submitPracticeInputSchema.safeParse({ attemptId, mediaId: attemptId, text: "Extra" }).success,
    ).toBe(false);
  });
  it("bounds playback credentials and rejects invalid provider duration", () => {
    expect(playbackTtl(60)).toBe(960);
    expect(playbackTtl(20000)).toBe(14400);
    for (const value of [NaN, Infinity, 0, -1]) expect(() => playbackTtl(value)).toThrow();
  });
});
