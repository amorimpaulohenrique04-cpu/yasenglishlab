import { describe, expect, it } from "vitest";

import type { LearningCourse } from "@/modules/learning";
import {
  attendanceRatePercent,
  buildAssessmentView,
  buildAttendanceView,
  buildCurriculumView,
  buildHistory,
  buildPracticeView,
  skillDisplayRatio,
  type ProgressAssessmentFact,
  type ProgressAttendanceFact,
  type ProgressPracticeFact,
} from "@/modules/progress";

const now = new Date("2026-10-01T12:00:00Z");

function course(
  id = "40000000-0000-4000-8000-000000000001",
  firstCompletion = 100,
): LearningCourse {
  return {
    id,
    slug: `course-${id.slice(-1)}`,
    title: `Course ${id.slice(-1)}`,
    description: null,
    modules: [
      {
        id: `41000000-0000-4000-8000-00000000000${id.slice(-1)}`,
        courseId: id,
        position: 1,
        title: "Module",
        description: null,
        lessons: [
          {
            id: `42000000-0000-4000-8000-00000000000${id.slice(-1)}`,
            moduleId: `41000000-0000-4000-8000-00000000000${id.slice(-1)}`,
            position: 1,
            slug: "lesson-one",
            title: "Lesson one",
            estimatedMinutes: 10,
            progress:
              firstCompletion === 0
                ? null
                : {
                    id: `43000000-0000-4000-8000-00000000000${id.slice(-1)}`,
                    enrollmentId: `44000000-0000-4000-8000-00000000000${id.slice(-1)}`,
                    lessonId: `42000000-0000-4000-8000-00000000000${id.slice(-1)}`,
                    userId: "81000000-0000-4000-8000-000000000001",
                    status: firstCompletion === 100 ? "COMPLETED" : "IN_PROGRESS",
                    completionPercent: firstCompletion,
                    lastPositionSeconds: 60,
                    startedAt: "2026-09-29T10:00:00Z",
                    lastAccessedAt: "2026-09-30T10:00:00Z",
                    completedAt:
                      firstCompletion === 100 ? "2026-09-30T10:00:00Z" : null,
                    updatedAt: "2026-09-30T10:00:00Z",
                  },
          },
          {
            id: `42000000-0000-4000-8000-00000000001${id.slice(-1)}`,
            moduleId: `41000000-0000-4000-8000-00000000000${id.slice(-1)}`,
            position: 2,
            slug: "lesson-two",
            title: "Lesson two",
            estimatedMinutes: 10,
            progress: null,
          },
        ],
      },
    ],
  };
}

function practice(overrides: Partial<ProgressPracticeFact> = {}): ProgressPracticeFact {
  return {
    attemptId: "84000000-0000-4000-8000-000000000001",
    activityId: "83000000-0000-4000-8000-000000000001",
    activityTitle: "Vocabulary check",
    skill: "VOCABULARY",
    estimatedMinutes: 5,
    status: "SUBMITTED",
    startedAt: "2026-09-30T09:00:00Z",
    submittedAt: "2026-09-30T09:05:00Z",
    evaluationStatus: "CORRECT",
    score: 1,
    maxScore: 1,
    ...overrides,
  };
}

function attendance(
  overrides: Partial<ProgressAttendanceFact> = {},
): ProgressAttendanceFact {
  return {
    bookingId: "85000000-0000-4000-8000-000000000001",
    liveSessionId: "85100000-0000-4000-8000-000000000001",
    title: "Conversation Lab",
    sessionType: "CONVERSATION_LAB",
    startsAt: "2026-09-30T15:00:00Z",
    bookingStatus: "BOOKED",
    bookedAt: "2026-09-29T12:00:00Z",
    cancelledAt: null,
    attendanceStatus: "ATTENDED",
    attendanceMarkedAt: "2026-09-30T16:00:00Z",
    ...overrides,
  };
}

function assessment(
  overrides: Partial<ProgressAssessmentFact> = {},
): ProgressAssessmentFact {
  return {
    attemptId: "86000000-0000-4000-8000-000000000001",
    status: "SCORED",
    startedAt: "2026-09-28T10:00:00Z",
    submittedAt: "2026-09-28T10:30:00Z",
    scoredAt: "2026-09-28T10:35:00Z",
    rawScore: 1,
    skillScores: [
      {
        skill: "GRAMMAR",
        score: 1,
        maxScore: 2,
        createdAt: "2026-09-28T10:35:00Z",
      },
    ],
    ...overrides,
  };
}

describe("Progress projection", () => {
  it("reuses canonical course completion semantics and real completion counts", () => {
    const view = buildCurriculumView([course()]);

    expect(view.courses[0]).toMatchObject({
      completionPercent: 50,
      lessonsCompleted: 1,
      totalLessons: 2,
      modulesCompleted: 0,
      totalModules: 1,
    });
  });

  it("keeps multiple courses separate instead of producing a global average", () => {
    const view = buildCurriculumView([
      course("40000000-0000-4000-8000-000000000001", 100),
      course("40000000-0000-4000-8000-000000000002", 0),
    ]);

    expect(view.courses.map((item) => item.completionPercent)).toEqual([50, 0]);
    expect(view).not.toHaveProperty("completionPercent");
  });

  it("does not turn absent objective progress into a numeric zero", () => {
    const view = buildAssessmentView([]);

    expect(view.skills.every((skill) => skill.score === null)).toBe(true);
    expect(view.skills.every((skill) => skill.maxScore === null)).toBe(true);
  });

  it("keeps Practice pending as pending instead of zero", () => {
    const view = buildPracticeView(
      [
        practice({
          evaluationStatus: "PENDING_MANUAL",
          score: null,
          maxScore: null,
        }),
      ],
      now,
    );

    expect(view.recent[0]).toMatchObject({
      evaluationStatus: "PENDING_MANUAL",
      score: null,
      maxScore: null,
    });
  });

  it("keeps Practice scores inside Practice without creating proficiency fields", () => {
    const view = buildPracticeView([practice({ score: 1, maxScore: 1 })], now);

    expect(view.recent[0]?.score).toBe(1);
    expect(view.recent[0]).not.toHaveProperty("cefrLevel");
    expect(view.recent[0]).not.toHaveProperty("proficiency");
  });

  it("distinguishes marked attendance, pending booking and cancellation", () => {
    const view = buildAttendanceView([
      attendance(),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000002",
        attendanceStatus: "NO_SHOW",
      }),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000003",
        attendanceStatus: null,
        attendanceMarkedAt: null,
      }),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000004",
        bookingStatus: "CANCELLED",
        attendanceStatus: null,
        attendanceMarkedAt: null,
        cancelledAt: "2026-09-30T12:00:00Z",
      }),
    ]);

    expect(view).toMatchObject({ attended: 1, noShow: 1, pending: 1, cancelled: 1 });
  });

  it("uses only ATTENDED + NO_SHOW marked active bookings in attendance rate", () => {
    const facts = [
      attendance(),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000002",
        attendanceStatus: "NO_SHOW",
      }),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000003",
        attendanceStatus: null,
        attendanceMarkedAt: null,
      }),
      attendance({
        bookingId: "85000000-0000-4000-8000-000000000004",
        bookingStatus: "TEACHER_CANCELLED",
        attendanceStatus: "NO_SHOW",
      }),
    ];

    expect(attendanceRatePercent(facts)).toBe(50);
  });

  it("keeps an objective SkillScore as an objective score on its original scale", () => {
    const view = buildAssessmentView([assessment()]);

    expect(view.skills.find((skill) => skill.skill === "GRAMMAR")).toMatchObject({
      score: 1,
      maxScore: 2,
    });
  });

  it("represents an unscored skill as not evaluated instead of zero", () => {
    const view = buildAssessmentView([assessment()]);

    expect(view.skills.find((skill) => skill.skill === "SPEAKING")).toMatchObject({
      score: null,
      maxScore: null,
      attemptId: null,
    });
  });

  it("creates a display ratio only when score and a positive maxScore exist", () => {
    expect(skillDisplayRatio(1, 2)).toBe(50);
    expect(skillDisplayRatio(null, 2)).toBeNull();
    expect(skillDisplayRatio(1, null)).toBeNull();
    expect(skillDisplayRatio(0, 0)).toBeNull();
  });

  it("never converts a perfect objective score into CEFR", () => {
    const view = buildAssessmentView([
      assessment({
        skillScores: [
          {
            skill: "GRAMMAR",
            score: 2,
            maxScore: 2,
            createdAt: "2026-09-28T10:35:00Z",
          },
        ],
      }),
    ]);

    expect(view.skills.find((skill) => skill.skill === "GRAMMAR")?.score).toBe(2);
    expect(JSON.stringify(view)).not.toMatch(/"cefr|A1|A2|B1|B2|C1|C2/);
  });

  it("uses only real timestamps to build history and excludes unfinished Practice", () => {
    const history = buildHistory({
      courses: [course()],
      practice: [
        practice(),
        practice({
          attemptId: "84000000-0000-4000-8000-000000000002",
          status: "IN_PROGRESS",
          submittedAt: null,
          evaluationStatus: null,
          score: null,
          maxScore: null,
        }),
      ],
      attendance: [attendance()],
      assessments: [assessment()],
    });

    expect(history.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        "lesson_completed",
        "practice_submitted",
        "attendance_marked",
        "assessment_submitted",
        "assessment_scored",
      ]),
    );
    expect(history.filter((event) => event.kind === "practice_submitted")).toHaveLength(1);
  });

  it("orders history deterministically by real timestamp, newest first", () => {
    const history = buildHistory({
      courses: [],
      practice: [
        practice({
          attemptId: "84000000-0000-4000-8000-000000000002",
          submittedAt: "2026-09-30T08:00:00Z",
        }),
        practice({
          attemptId: "84000000-0000-4000-8000-000000000003",
          submittedAt: "2026-09-30T10:00:00Z",
        }),
      ],
      attendance: [],
      assessments: [],
    });

    expect(history.map((event) => event.occurredAt)).toEqual([
      "2026-09-30T10:00:00Z",
      "2026-09-30T08:00:00Z",
    ]);
  });
});
