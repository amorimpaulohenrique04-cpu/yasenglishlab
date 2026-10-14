import "server-only";

import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

// ADR 0017: explicit complimentary access. Every write goes through the ADMIN+AAL2 RPCs (audited in the
// database); this adapter only validates input and maps failures to codes that carry no SQL detail.

export type ComplimentaryGrantView = Readonly<{
  reason: "ADMIN_GRANT" | "LEGACY_BACKFILL";
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  active: boolean;
}>;

export type EnrollmentWithoutCohort = Readonly<{
  enrollmentId: string;
  userId: string;
  courseTitle: string;
  displayName: string | null;
  enrolledAt: string;
}>;

export class ComplimentaryAccessError extends Error {
  constructor(readonly code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "UNAVAILABLE") {
    super(code);
    this.name = "ComplimentaryAccessError";
  }
}

const grantRow = z
  .object({
    reason: z.enum(["ADMIN_GRANT", "LEGACY_BACKFILL"]),
    granted_at: z.string(),
    expires_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
  })
  .nullable();

const note = z.string().trim().min(1).max(500);
const grantInput = z.object({
  userId: z.uuid(),
  note,
  // HTML date input (YYYY-MM-DD) → end of that day in America/Recife; empty means no expiry.
  expiresOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
const revokeInput = z.object({ userId: z.uuid(), note });

function mapRpcError(error: { code?: string } | null): ComplimentaryAccessError {
  if (error?.code === "42501") return new ComplimentaryAccessError("FORBIDDEN");
  if (error?.code === "22023") return new ComplimentaryAccessError("INVALID");
  if (error?.code === "23514") return new ComplimentaryAccessError("NOT_FOUND");
  return new ComplimentaryAccessError("UNAVAILABLE");
}

function isActive(row: NonNullable<z.infer<typeof grantRow>>, now: Date): boolean {
  if (row.revoked_at) return false;
  if (!row.expires_at) return true;
  const millis = Date.parse(row.expires_at);
  return !Number.isNaN(millis) && millis > now.getTime();
}

export async function loadComplimentaryGrant(
  studentUserId: string,
): Promise<ComplimentaryGrantView | null> {
  await assertRole("ADMIN");
  const id = z.uuid().parse(studentUserId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("complimentary_access_grants")
    .select("reason,granted_at,expires_at,revoked_at")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new ComplimentaryAccessError("UNAVAILABLE");
  const row = grantRow.parse(data ?? null);
  if (!row) return null;
  return {
    reason: row.reason,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active: isActive(row, new Date()),
  };
}

export async function grantComplimentaryAccess(input: unknown): Promise<void> {
  await assertRole("ADMIN");
  const parsed = grantInput.safeParse(input);
  if (!parsed.success) throw new ComplimentaryAccessError("INVALID");
  const expiresAt = parsed.data.expiresOn ? `${parsed.data.expiresOn}T23:59:59-03:00` : null;
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("grant_complimentary_access", {
    p_user: parsed.data.userId,
    p_note: parsed.data.note,
    p_expires_at: expiresAt,
  });
  if (error) throw mapRpcError(error);
}

export async function revokeComplimentaryAccess(input: unknown): Promise<void> {
  await assertRole("ADMIN");
  const parsed = revokeInput.safeParse(input);
  if (!parsed.success) throw new ComplimentaryAccessError("INVALID");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("revoke_complimentary_access", {
    p_user: parsed.data.userId,
    p_note: parsed.data.note,
  });
  if (error) throw mapRpcError(error);
}

const withoutCohortRows = z.array(
  z.object({
    enrollment_id: z.string(),
    user_id: z.string(),
    course_title: z.string(),
    display_name: z.string().nullable(),
    enrolled_at: z.string(),
  }),
);

export async function loadEnrollmentsWithoutActiveCohort(): Promise<EnrollmentWithoutCohort[]> {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_enrollments_without_active_cohort", {
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw new ComplimentaryAccessError("UNAVAILABLE");
  return withoutCohortRows.parse(data ?? []).map((row) => ({
    enrollmentId: row.enrollment_id,
    userId: row.user_id,
    courseTitle: row.course_title,
    displayName: row.display_name,
    enrolledAt: row.enrolled_at,
  }));
}
