import { z } from "zod";

const idSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });
const nullableDateTimeSchema = dateTimeSchema.nullable();
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const USER_ROLES = ["STUDENT", "TEACHER", "SUPPORT", "ADMIN"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const cefrLevelSchema = z.enum(CEFR_LEVELS);

export const SKILLS = [
  "READING",
  "LISTENING",
  "SPEAKING",
  "VOCABULARY",
  "GRAMMAR",
  "PRONUNCIATION",
] as const;
export const skillSchema = z.enum(SKILLS);

export const planCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/);
export const entitlementKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);

export const profileSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    displayName: z.string().trim().min(1).max(120),
    avatarUrl: z.string().url().nullable(),
    locale: z.string().min(2).max(35),
    timezone: z.string().min(1).max(80),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;

export const roleAssignmentSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    role: userRoleSchema,
    createdAt: dateTimeSchema,
  })
  .strict();
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;

export const planSchema = z
  .object({
    id: idSchema,
    code: planCodeSchema,
    name: z.string().min(1).max(80),
    description: z.string().nullable(),
    currency: z.string().length(3),
    amountCents: z.number().int().nonnegative(),
    billingInterval: z.literal("MONTH"),
    active: z.boolean(),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;

export const entitlementSchema = z
  .object({
    id: idSchema,
    key: entitlementKeySchema,
    description: z.string().min(1),
    unit: z.enum(["COUNT", "BOOLEAN"]),
    active: z.boolean(),
  })
  .strict();
export type Entitlement = z.infer<typeof entitlementSchema>;

export const planEntitlementSchema = z
  .object({
    id: idSchema,
    planId: idSchema,
    entitlementId: idSchema,
    limitValue: z.number().nonnegative(),
    cadence: z.enum(["WEEK", "MONTH", "NONE"]),
    effectiveFrom: dateTimeSchema,
    effectiveTo: nullableDateTimeSchema,
  })
  .strict();
export type PlanEntitlement = z.infer<typeof planEntitlementSchema>;

export const subscriptionSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    planId: idSchema,
    provider: z.string().min(1).max(40),
    providerCustomerId: z.string().nullable(),
    providerSubscriptionId: z.string().nullable(),
    status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]),
    currentPeriodStart: nullableDateTimeSchema,
    currentPeriodEnd: nullableDateTimeSchema,
    cancelAtPeriodEnd: z.boolean(),
    startedAt: dateTimeSchema,
    endedAt: nullableDateTimeSchema,
  })
  .strict();
export type Subscription = z.infer<typeof subscriptionSchema>;

export const courseSchema = z
  .object({
    id: idSchema,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    description: z.string().nullable(),
    active: z.boolean(),
  })
  .strict();
export type Course = z.infer<typeof courseSchema>;

export const moduleSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    position: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().nullable(),
  })
  .strict();
export type CourseModule = z.infer<typeof moduleSchema>;

export const lessonSchema = z
  .object({
    id: idSchema,
    moduleId: idSchema,
    position: z.number().int().positive(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    estimatedMinutes: z.number().int().positive().nullable(),
  })
  .strict();
export type Lesson = z.infer<typeof lessonSchema>;

export const lessonAssetSchema = z
  .object({
    id: idSchema,
    lessonId: idSchema,
    assetType: z.enum(["VIDEO", "AUDIO", "TEXT", "PDF", "EXERCISE", "LINK"]),
    position: z.number().int().positive(),
    sourceUrl: z.string().url().nullable(),
    storagePath: z.string().nullable(),
    content: z.unknown().nullable(),
    metadata: jsonObjectSchema,
  })
  .strict();
export type LessonAsset = z.infer<typeof lessonAssetSchema>;

export const enrollmentSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    courseId: idSchema,
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
    enrolledAt: dateTimeSchema,
    completedAt: nullableDateTimeSchema,
  })
  .strict();
export type Enrollment = z.infer<typeof enrollmentSchema>;

export const lessonProgressSchema = z
  .object({
    id: idSchema,
    enrollmentId: idSchema,
    lessonId: idSchema,
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
    progressPercent: z.number().min(0).max(100),
    startedAt: nullableDateTimeSchema,
    completedAt: nullableDateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict();
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

const practiceSkillSchema = z.enum([
  "SPEAKING",
  "LISTENING",
  "PRONUNCIATION",
  "VOCABULARY",
  "GRAMMAR",
]);

export const practiceActivitySchema = z
  .object({
    id: idSchema,
    slug: z.string().min(1),
    title: z.string().min(1),
    skill: practiceSkillSchema,
    cefrTarget: cefrLevelSchema.nullable(),
    difficulty: z.string().nullable(),
    estimatedMinutes: z.number().int().positive(),
    relatedModuleId: idSchema.nullable(),
    relatedLessonId: idSchema.nullable(),
    content: jsonObjectSchema,
    active: z.boolean(),
  })
  .strict();
export type PracticeActivity = z.infer<typeof practiceActivitySchema>;

export const practiceAttemptSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    practiceActivityId: idSchema,
    status: z.enum(["IN_PROGRESS", "SUBMITTED", "ABANDONED"]),
    startedAt: dateTimeSchema,
    submittedAt: nullableDateTimeSchema,
    context: jsonObjectSchema,
  })
  .strict();
export type PracticeAttempt = z.infer<typeof practiceAttemptSchema>;

export const practiceResultSchema = z
  .object({
    id: idSchema,
    practiceAttemptId: idSchema,
    score: z.number().nullable(),
    maxScore: z.number().nonnegative().nullable(),
    feedback: z.string().nullable(),
    metrics: jsonObjectSchema,
    createdAt: dateTimeSchema,
  })
  .strict();
export type PracticeResult = z.infer<typeof practiceResultSchema>;

export const materialSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    materialType: z.enum([
      "PDF",
      "SUMMARY",
      "VOCABULARY",
      "GRAMMAR",
      "AUDIO",
      "WORKSHEET",
      "ANSWER_KEY",
    ]),
    moduleId: idSchema.nullable(),
    lessonId: idSchema.nullable(),
    storagePath: z.string().nullable(),
    externalUrl: z.string().url().nullable(),
    metadata: jsonObjectSchema,
    active: z.boolean(),
  })
  .strict();
export type Material = z.infer<typeof materialSchema>;

export const materialFavoriteSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    materialId: idSchema,
    createdAt: dateTimeSchema,
  })
  .strict();
export type MaterialFavorite = z.infer<typeof materialFavoriteSchema>;

export const assessmentSchema = z
  .object({
    id: idSchema,
    slug: z.string().min(1),
    title: z.string().min(1),
    purpose: z.string().min(1),
    active: z.boolean(),
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;

export const assessmentVersionSchema = z
  .object({
    id: idSchema,
    assessmentId: idSchema,
    versionNumber: z.number().int().positive(),
    status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
    specification: jsonObjectSchema,
    scoringConfig: jsonObjectSchema,
    publishedAt: nullableDateTimeSchema,
  })
  .strict();
export type AssessmentVersion = z.infer<typeof assessmentVersionSchema>;

export const assessmentItemSchema = z
  .object({
    id: idSchema,
    assessmentVersionId: idSchema,
    position: z.number().int().positive(),
    skill: skillSchema,
    cefrTarget: cefrLevelSchema.nullable(),
    itemType: z.string().min(1),
    prompt: jsonObjectSchema,
    answerKey: jsonObjectSchema.nullable(),
    rubric: jsonObjectSchema.nullable(),
  })
  .strict();
export type AssessmentItem = z.infer<typeof assessmentItemSchema>;

export const assessmentAttemptSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    assessmentVersionId: idSchema,
    status: z.enum(["IN_PROGRESS", "SUBMITTED", "SCORED", "INVALIDATED"]),
    startedAt: dateTimeSchema,
    submittedAt: nullableDateTimeSchema,
    scoredAt: nullableDateTimeSchema,
    rawScore: z.number().nullable(),
    resultCefr: cefrLevelSchema.nullable(),
    resultMetadata: jsonObjectSchema,
  })
  .strict();
export type AssessmentAttempt = z.infer<typeof assessmentAttemptSchema>;

export const assessmentResponseSchema = z
  .object({
    id: idSchema,
    assessmentAttemptId: idSchema,
    assessmentItemId: idSchema,
    response: z.unknown(),
    score: z.number().nullable(),
    feedback: z.string().nullable(),
    scoredAt: nullableDateTimeSchema,
  })
  .strict();
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;

export const skillScoreSchema = z
  .object({
    id: idSchema,
    assessmentAttemptId: idSchema,
    skill: skillSchema,
    score: z.number(),
    maxScore: z.number().nonnegative().nullable(),
    cefrLevel: cefrLevelSchema.nullable(),
    provenance: jsonObjectSchema,
    createdAt: dateTimeSchema,
  })
  .strict();
export type SkillScore = z.infer<typeof skillScoreSchema>;

export const teacherSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    bio: z.string().nullable(),
    active: z.boolean(),
  })
  .strict();
export type Teacher = z.infer<typeof teacherSchema>;

export const teacherAvailabilitySchema = z
  .object({
    id: idSchema,
    teacherId: idSchema,
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    timezone: z.string().min(1),
  })
  .strict();
export type TeacherAvailability = z.infer<typeof teacherAvailabilitySchema>;

export const liveSessionSchema = z
  .object({
    id: idSchema,
    teacherId: idSchema,
    sessionType: z.enum(["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION", "WORKSHOP"]),
    title: z.string().min(1),
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    capacity: z.number().int().min(1).max(6),
    requiredEntitlementKey: entitlementKeySchema.nullable(),
    status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]),
    meetingProvider: z.string().nullable(),
    meetingRef: z.string().nullable(),
  })
  .strict()
  .superRefine((session, ctx) => {
    if (session.sessionType === "PRIVATE_SESSION" && session.capacity !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["capacity"],
        message: "Private sessions must have capacity 1.",
      });
    }
  });
export type LiveSession = z.infer<typeof liveSessionSchema>;

export const sessionBookingSchema = z
  .object({
    id: idSchema,
    liveSessionId: idSchema,
    userId: idSchema,
    status: z.enum(["BOOKED", "CANCELLED", "TEACHER_CANCELLED"]),
    bookedAt: dateTimeSchema,
    cancelledAt: nullableDateTimeSchema,
  })
  .strict();
export type SessionBooking = z.infer<typeof sessionBookingSchema>;

export const attendanceSchema = z
  .object({
    id: idSchema,
    sessionBookingId: idSchema,
    status: z.enum(["ATTENDED", "NO_SHOW"]),
    markedAt: dateTimeSchema,
    markedByUserId: idSchema.nullable(),
    notes: z.string().nullable(),
  })
  .strict();
export type Attendance = z.infer<typeof attendanceSchema>;

export const notificationSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    notificationType: z.string().min(1),
    title: z.string().min(1),
    body: z.string(),
    data: jsonObjectSchema,
    readAt: nullableDateTimeSchema,
    createdAt: dateTimeSchema,
  })
  .strict();
export type Notification = z.infer<typeof notificationSchema>;

export const auditLogSchema = z
  .object({
    id: idSchema,
    actorUserId: idSchema.nullable(),
    action: z.string().min(1),
    entityType: z.string().min(1),
    entityId: idSchema.nullable(),
    data: jsonObjectSchema,
    occurredAt: dateTimeSchema,
  })
  .strict();
export type AuditLog = z.infer<typeof auditLogSchema>;

export const billingEventSchema = z
  .object({
    id: idSchema,
    provider: z.string().min(1),
    eventId: z.string().min(1),
    eventType: z.string().min(1),
    subscriptionId: idSchema.nullable(),
    payload: jsonObjectSchema,
    occurredAt: dateTimeSchema,
    receivedAt: dateTimeSchema,
    processedAt: nullableDateTimeSchema,
    processingError: z.string().nullable(),
  })
  .strict();
export type BillingEvent = z.infer<typeof billingEventSchema>;
