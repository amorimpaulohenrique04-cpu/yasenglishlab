import { z } from "zod";

export const manualMeetingUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (/[\u0000-\u0020]/.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Informe uma URL HTTPS sem credenciais.");

export const teacherSessionInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    session_type: z.enum(["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION"]),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    capacity: z.coerce.number().int().min(1).max(6),
    cohort_id: z.uuid().nullable(),
    target_student_user_id: z.uuid().nullable(),
    meeting_url: manualMeetingUrlSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) => Date.parse(input.ends_at) > Date.parse(input.starts_at),
    "O término deve ser após o início.",
  );

export type TeacherSessionInput = z.infer<typeof teacherSessionInputSchema>;
export interface TeacherSessionCommandPort {
  saveSession(id: string | null, input: TeacherSessionInput): Promise<string>;
}
export async function saveTeacherSession(
  port: TeacherSessionCommandPort,
  id: string | null,
  input: unknown,
) {
  if (id) z.uuid().parse(id);
  return port.saveSession(id, teacherSessionInputSchema.parse(input));
}
