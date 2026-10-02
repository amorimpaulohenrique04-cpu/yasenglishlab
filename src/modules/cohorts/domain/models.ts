import { z } from "zod";
const uuid = z.string().uuid();
const cohortDate = z.union([z.string().datetime({ offset: true }), z.iso.date()]);
export const cohortSchema = z.object({
  id: uuid,
  course_id: uuid,
  name: z.string(),
  code: z.string(),
  status: z.enum(["PLANNED", "ACTIVE", "ARCHIVED"]),
  timezone: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
});
export type Cohort = z.infer<typeof cohortSchema>;
export const cohortCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("CREATE"),
      cohortId: z.null(),
      input: z
        .object({
          course_id: uuid,
          name: z.string().trim().min(1).max(120),
          code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          starts_at: cohortDate,
          timezone: z.string().min(1).max(100),
          ends_at: cohortDate.nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("EDIT"),
      cohortId: uuid,
      input: z.object({ name: z.string().trim().min(1).max(120) }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("STATUS"),
      cohortId: uuid,
      input: z.object({ status: z.enum(["PLANNED", "ACTIVE", "ARCHIVED"]) }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.enum(["ADD_STUDENT", "REMOVE_STUDENT"]),
      cohortId: uuid,
      input: z.object({ user_id: uuid }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.enum(["ADD_TEACHER", "REMOVE_TEACHER"]),
      cohortId: uuid,
      input: z.object({ teacher_id: uuid, is_primary: z.boolean() }).strict(),
    })
    .strict(),
]);
export type CohortCommand = z.infer<typeof cohortCommandSchema>;
export interface CohortOptions {
  courses: { value: string; label: string }[];
  students: { value: string; label: string }[];
  teachers: { value: string; label: string }[];
}
