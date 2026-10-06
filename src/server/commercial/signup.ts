import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signupSchema, checkoutPath } from "@/modules/commercial/contracts";
import { getServerSupabaseEnvironment } from "@/server/env";

export async function ensurePublicStudentRole(userId: string, client: SupabaseClient) {
  const id = z.uuid().parse(userId);
  const { data, error: readError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", id);
  if (readError || data?.some((role) => role.role !== "STUDENT"))
    throw new Error("Student registration unavailable");
  const { error } = await client
    .from("user_roles")
    .upsert(
      { user_id: id, role: "STUDENT" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  if (error) throw new Error("Student registration unavailable");
}

export function signupCallback(plan?: string) {
  const url = new URL(getServerSupabaseEnvironment().appUrl);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  )
    throw new Error("Invalid application origin");
  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", checkoutPath(plan));
  return callback.toString();
}

// Retry capability is issued only for the UUID returned by our own SDK signup.
// The browser cannot substitute a target; no generic role-management API exists.
const retrySchema = z.object({
  userId: z.uuid(),
  plan: z.string().optional(),
  expires: z.number(),
});
function signature(payload: string) {
  return createHmac("sha256", getServerSupabaseEnvironment().serviceRoleKey)
    .update(`public-student-registration:${payload}`)
    .digest("hex");
}
export function registrationRetry(userId: string, plan?: string) {
  const payload = Buffer.from(
    JSON.stringify(
      retrySchema.parse({ userId, ...(plan ? { plan } : {}), expires: Date.now() + 900000 }),
    ),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readRegistrationRetry(value: string | undefined) {
  if (!value || value.length > 1024) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac || !/^[a-f0-9]{64}$/.test(mac)) return null;
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(payload), "hex")))
    return null;
  try {
    const result = retrySchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return result.expires > Date.now() ? result : null;
  } catch {
    return null;
  }
}

export async function registerStudent(
  input: unknown,
  auth: SupabaseClient,
  admin: SupabaseClient,
  validPlan: (code: string) => Promise<boolean>,
) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { kind: "invalid" as const, errors: parsed.error.flatten().fieldErrors };
  const value = parsed.data;
  if (value.plan && !(await validPlan(value.plan)))
    return { kind: "invalid" as const, errors: { plan: ["Escolha um plano disponível."] } };
  const { data, error } = await auth.auth.signUp({
    email: value.email,
    password: value.password,
    options: { data: { display_name: value.name }, emailRedirectTo: signupCallback(value.plan) },
  });
  // Obfuscated existing-user responses never grant a role or reveal account existence.
  if (error || !data.user || data.user.identities?.length === 0) return { kind: "email" as const };
  try {
    await ensurePublicStudentRole(data.user.id, admin);
  } catch {
    return { kind: "retry" as const, token: registrationRetry(data.user.id, value.plan) };
  }
  return data.session
    ? { kind: "session" as const, destination: checkoutPath(value.plan) }
    : { kind: "email" as const };
}
