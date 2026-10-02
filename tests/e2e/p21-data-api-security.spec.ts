import { createHmac, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownPrivateSessionId = "88100000-0000-4000-8000-000000000003";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

if (enabled && (!password || !url || !publishableKey || !serviceRoleKey)) {
  throw new Error("P21 Data API E2E requires canonical local Supabase credentials.");
}

function client(): SupabaseClient {
  if (!url || !publishableKey) throw new Error("Public Supabase client unavailable.");
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string): string {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

test.describe("P21 Data API security", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(90_000);

  test("PostgREST enforces Student isolation and server-only metadata", async () => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    const studentA = client();
    const studentB = client();
    expect(
      (
        await studentA.auth.signInWithPassword({
          email: "canonical.student@example.test",
          password,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await studentB.auth.signInWithPassword({
          email: "canonical.cohort-student@example.test",
          password,
        })
      ).error,
    ).toBeNull();

    const own = await studentA.from("live_sessions").select("id,title").eq("id", ownPrivateSessionId);
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const foreign = await studentB
      .from("live_sessions")
      .select("id,title")
      .eq("id", ownPrivateSessionId);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);

    const meetingMetadata = await studentA
      .from("live_sessions")
      .select("id,meeting_ref")
      .eq("id", ownPrivateSessionId);
    expect(meetingMetadata.error).not.toBeNull();

    const providerLifecycle = await studentA
      .from("lesson_video_assets")
      .select("id,provider_playback_id")
      .limit(1);
    expect(providerLifecycle.error).not.toBeNull();

    const audioMetadata = await studentA
      .from("practice_response_media")
      .select("id,storage_path")
      .limit(1);
    expect(audioMetadata.error).not.toBeNull();

    const teacherNotes = await studentA.from("teacher_student_notes").select("id,body").limit(1);
    expect(teacherNotes.error).not.toBeNull();

    await studentA.auth.signOut();
    await studentB.auth.signOut();
  });

  test("privileged Teacher RPC denies AAL1 and succeeds after real TOTP AAL2", async () => {
    if (!password || !url || !serviceRoleKey) {
      throw new Error("Canonical E2E environment is incomplete.");
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = `p21-data-api-${randomUUID()}@example.test`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "P21 Data API Teacher" },
    });
    if (createError || !created.user) throw createError ?? new Error("Teacher creation failed.");
    const userId = created.user.id;
    const teacherId = randomUUID();

    try {
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "TEACHER" });
      if (roleError) throw roleError;
      const { error: teacherError } = await admin
        .from("teachers")
        .insert({ id: teacherId, user_id: userId, active: true });
      if (teacherError) throw teacherError;

      const teacher = client();
      const signedIn = await teacher.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull();

      const start = new Date(Date.now() + 60 * 86_400_000);
      const end = new Date(start.getTime() + 60 * 60_000);
      const aal1 = await teacher.rpc("manage_teacher_availability", {
        p_operation: "CREATE",
        p_id: null,
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
      });
      expect(aal1.error).not.toBeNull();
      expect(aal1.error?.message).toContain("AAL2");

      const enrolled = await teacher.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "P21 Data API test",
      });
      if (enrolled.error || !enrolled.data.totp?.secret) {
        throw enrolled.error ?? new Error("TOTP enrollment failed.");
      }
      const verified = await teacher.auth.mfa.challengeAndVerify({
        factorId: enrolled.data.id,
        code: totp(enrolled.data.totp.secret),
      });
      expect(verified.error).toBeNull();

      const assurance = await teacher.auth.mfa.getAuthenticatorAssuranceLevel();
      expect(assurance.error).toBeNull();
      expect(assurance.data.currentLevel).toBe("aal2");

      const aal2 = await teacher.rpc("manage_teacher_availability", {
        p_operation: "CREATE",
        p_id: null,
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
      });
      expect(aal2.error).toBeNull();
      expect(aal2.data).toMatch(/^[0-9a-f-]{36}$/i);
      await teacher.auth.signOut();
    } finally {
      await admin.from("teacher_availability").delete().eq("teacher_id", teacherId);
      await admin.from("teachers").delete().eq("id", teacherId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
