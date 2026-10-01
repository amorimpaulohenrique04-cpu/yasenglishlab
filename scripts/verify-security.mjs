import { assert, read, success, walk } from "./_verify-utils.mjs";

const browserClient = read("src/lib/supabase/browser.ts");
const serverClient = read("src/server/supabase/server.ts");
const proxy = read("src/lib/supabase/proxy.ts");
const serverEnv = read("src/server/env.ts");
const adminClient = read("src/server/supabase/admin.ts");
const authContext = read("src/server/auth/context.ts");
const signedUrlService = read("src/server/assets/signed-url.ts");
const bookingService = read("src/server/live/book-session.ts");
const scheduleBookingService = read("src/server/schedule/schedule.ts");
const agendaMigration = read("supabase/migrations/20261001005500_agenda_v1_booking.sql");
const observabilityPrivacy = read("src/server/observability/privacy.ts");
const observabilityMigration = read(
  "supabase/migrations/20260929233000_observability_analytics_audit.sql",
);
const authMigration = read("supabase/migrations/20260929043000_auth_rbac_rls.sql");
const rlsEvidence = read("supabase/tests/rls_permissions.sql");
const threatModel = read("docs/THREAT_MODEL.md");
const envExample = read(".env.example");

assert(
  !/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(browserClient),
  "Browser Supabase client references a service-role variable.",
);
assert(
  !/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(envExample),
  ".env.example exposes service role through NEXT_PUBLIC_*.",
);
assert(serverEnv.includes('import "server-only"'), "src/server/env.ts must import server-only.");
assert(
  adminClient.includes('import "server-only"'),
  "Supabase admin client must import server-only.",
);
assert(
  serverEnv.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Server env contract lost the service-role key.",
);
assert(
  envExample.includes("SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"),
  ".env.example must keep a non-secret service-role placeholder.",
);

assert(
  browserClient.includes("createBrowserClient") && serverClient.includes("createServerClient"),
  "Supabase SSR browser/server clients must use @supabase/ssr.",
);
assert(proxy.includes("auth.getClaims()"), "Route protection must verify claims.");
assert(
  authContext.includes('.from("user_roles")') && !authContext.includes("user_metadata"),
  "Roles must resolve server-side from durable user_roles.",
);
assert(
  bookingService.includes("bookCurrentStudentSession({ liveSessionId })") &&
    !bookingService.includes("createSupabaseAdminClient") &&
    scheduleBookingService.includes('assertRole("STUDENT")') &&
    !scheduleBookingService.includes("userId: string") &&
    agendaMigration.includes("current_user_id uuid := auth.uid()") &&
    agendaMigration.includes("private.has_role('STUDENT', false)") &&
    !agendaMigration.includes("book_live_session(p_live_session_id uuid, p_user_id"),
  "Booking identity must come from verified server auth plus PostgreSQL auth.uid(), never client input or service role.",
);
assert(
  signedUrlService.includes('.select("id")') &&
    signedUrlService.includes('.select("storage_path")') &&
    signedUrlService.includes("createSignedUrl(storagePath, ttlSeconds)") &&
    signedUrlService.includes("normalizeSignedUrlTtl") &&
    signedUrlService.includes("data: { ttl_seconds: ttlSeconds }") &&
    !signedUrlService.includes("signed_url:") &&
    !signedUrlService.includes("storage_path:"),
  "Protected signed URLs must be short-lived and audit metadata must exclude URL/path secrets.",
);

for (const token of [
  "teacher_student_assignments",
  "live_session_recordings",
  "private.has_role",
  "'aal2'",
  "profiles_own_select",
  "lesson_progress_authorized_select",
  "materials_authorized_select",
  "billing_events_admin_select",
  "yas-protected-assets",
  "grant select (",
]) {
  assert(authMigration.includes(token), `Security migration is missing: ${token}`);
}

for (const token of [
  "Student A must read own progress",
  "Student A must not read Student B progress",
  "Teacher X at aal2 must access assigned Student A",
  "Teacher X must not access unrelated Student B",
  "Support must not access privileged billing events",
  "Admin at aal1 must not access privileged billing records",
  "Anonymous role must not have protected profile SELECT privilege",
  "Authenticated users must not mutate roles directly",
  "Authenticated users must not manipulate progress directly",
  "Authenticated Data API must not expose protected storage paths",
  "Support must not access student learning progress by default",
]) {
  assert(rlsEvidence.includes(token), `RLS evidence is missing: ${token}`);
}

for (const token of [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "payment",
  "private[_-]?audio",
  "assessment[_-]?response",
]) {
  assert(
    observabilityPrivacy.toLowerCase().includes(token.toLowerCase()),
    `Observability privacy sanitizer is missing sensitive category: ${token}`,
  );
}

for (const token of [
  "revoke all on public.observability_events from public, anon, authenticated",
  "observability_events_no_update",
  "request_id uuid not null",
  "trace_id uuid not null",
  "span_id uuid not null",
]) {
  assert(
    observabilityMigration.toLowerCase().includes(token.toLowerCase()),
    `Observability migration is missing security invariant: ${token}`,
  );
}

for (const threat of [
  "Student reads another student",
  "Teacher reads unrelated student",
  "Escalation to ADMIN",
  "Entitlement manipulation",
  "Paid material access",
  "Recording access",
  "Signed URL leakage",
  "Booking above capacity",
  "Progress manipulation",
  "Checkout fraud",
  "Webhook replay / duplicate",
  "Malicious upload",
  "User enumeration",
  "Secret in client bundle",
  "Sensitive data in logs",
]) {
  assert(threatModel.includes(threat), `Threat model is missing: ${threat}`);
}

const sourceFiles = walk("src", (path) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path));
for (const path of sourceFiles) {
  const content = read(path);
  if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(content)) {
    throw new Error(`Public service-role exposure pattern found in ${path}`);
  }
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY") && path !== "src/server/env.ts") {
    throw new Error(`Direct service-role env access outside src/server/env.ts: ${path}`);
  }
  if (
    content.includes('"use client"') &&
    (content.includes('from "@/server/') || content.includes('import "server-only"'))
  ) {
    throw new Error(`Client module crosses the server-only boundary: ${path}`);
  }
}

const scanFiles = [
  ...sourceFiles,
  ".env.example",
  "next.config.ts",
  "playwright.config.ts",
  "vitest.config.ts",
];
const secretPatterns = [
  /sk_live_[A-Za-z0-9]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
];

for (const path of scanFiles) {
  const content = read(path);
  for (const pattern of secretPatterns) {
    assert(!pattern.test(content), `High-confidence secret pattern found in ${path}`);
  }
}

success(
  `Security boundary valid across ${sourceFiles.length} source files; RLS evidence and Yas threat model are present.`,
);
