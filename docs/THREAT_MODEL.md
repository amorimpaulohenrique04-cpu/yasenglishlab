# Threat Model — Yas English Lab

## Scope

This model covers the student portal, staff access, Supabase Auth/Postgres/Storage boundaries, billing mirrors, live-session booking and protected learning assets. It assumes the browser is attacker-controlled: DOM, JavaScript, request bodies and direct Data API calls are never authority.

## Trust boundaries

```text
Browser / hostile client
        |
        | publishable key + user JWT
        v
Supabase Auth + RLS/PostgREST ---- private Storage
        |
        | verified user context / AAL
        v
Next.js server actions + domain services
        |
        | server-only service role (narrowly used)
        v
Postgres durable invariants / providers
```

The service role is a bypass credential and is therefore restricted to server-only adapters after an explicit authorization check. Protected file URLs are issued only after a user-scoped RLS query has already authorized the asset.

## Threat register

| Threat | Asset | Attacker | Attack path | Impact | Control | Test / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Student reads another student | progress, profile, attempts, scores | authenticated student | change row IDs or call PostgREST directly | privacy breach / IDOR | ownership RLS based on `auth.uid()`; browser `user_id` is ignored | `supabase/tests/rls_permissions.sql`: Student A own progress allow; Student A → Student B deny |
| Teacher reads unrelated student | student profile and learning history | authenticated teacher | guess student UUID or alter frontend | broad staff data exposure | explicit `teacher_student_assignments`; teacher policies require active assignment **and AAL2** | RLS test: Teacher X assigned A allow, B deny; Teacher Y unrelated A deny |
| Escalation to ADMIN | roles and privileged records | student/staff account | insert/update `user_roles`, forge client metadata | full compromise | roles resolved from DB server-side; no authenticated role DML; admin mutation service requires ADMIN + AAL2; role changes audited | RLS privilege assertion + `src/server/auth/admin.ts` + security verifier |
| Entitlement manipulation | paid capabilities | subscriber | edit plan/subscription/plan_entitlements through API | unpaid access | no authenticated DML on subscription/plan entitlements; authorization reads durable entitlement state, not plan name or client claims | RLS privilege assertion; domain invariant tests |
| Paid material access | protected PDFs/audio | lower plan or unrelated user | enumerate material IDs or bypass UI | content leakage | material RLS checks enrollment + entitlement; protected material cannot use permanent external URL; signed URL issued after RLS | Student A TALK allow; Student B START deny |
| Recording access | class recording | unbooked student / lower plan | guess recording ID or storage path | content/privacy leak | recording metadata RLS requires booking + entitlement; teacher must own session; storage remains private | booked Student A allow; Student B deny |
| Signed URL leakage | temporary asset bearer URL | third party receiving leaked URL | copy URL from browser/history/log | temporary unauthorized download | private bucket; authorization before signing; TTL clamped 30–300s; URLs are never written to audit logs | `normalizeSignedUrlTtl` unit test + `createProtectedAssetSignedUrl` audit metadata only |
| Booking above capacity | live-session seats | concurrent students | race two bookings at final seat | overbooking / entitlement abuse | server-owned booking identity; authenticated direct INSERT denied; DB locks `live_sessions FOR UPDATE` before capacity count | PROMPT 05 DB invariant + RLS privilege assertion |
| Progress manipulation | curriculum progress | student | send another user ID or direct UPDATE | false completion / analytics corruption | authenticated direct UPDATE denied; future progress command must derive actor from verified session | RLS privilege assertion; server auth rule |
| Checkout fraud | subscription/entitlement state | customer | fake redirect/success page or mutate local mirror | unpaid access | checkout redirect never grants access; subscription/entitlement writes are server/provider-only; access uses confirmed local state | no authenticated subscription/entitlement DML; billing contract |
| Webhook replay / duplicate | billing state | replay attacker / provider retries | resend valid provider event | duplicate credits/state transitions | `billing_events(provider,event_id)` unique and immutable; provider adapter must verify signature before persistence | `supabase/tests/domain_invariants.sql` duplicate event assertion |
| Malicious upload | storage, downstream parsers, users | authenticated user | upload oversized/polyglot/executable content | malware/storage abuse | protected bucket is private with size/MIME allowlist; no authenticated Storage upload policy exists in this task; any future upload endpoint must validate actual file type server-side before storage | migration bucket config + security verifier; no client upload grant |
| User enumeration | account existence | anonymous attacker | compare password-reset responses | privacy / targeted attacks | recovery always returns the same visible state regardless of account existence or Auth error | `requestPasswordResetAction` intentionally discards provider result |
| Secret in client bundle | service-role/provider credentials | site visitor | inspect JS/env/network | total backend bypass | only publishable key is public; service role imported through `server-only` env/admin modules; CI scans public-secret patterns and client→server imports | `scripts/verify-security.mjs` |
| Sensitive data in logs | passwords, tokens, provider payload, signed URLs | staff/log reader after incident | accidental logging/audit serialization | secondary credential/privacy breach | audit payloads are allowlisted; no password/token/URL stored; billing payload is not selectable through authenticated Data API | audit trigger allowlist + column grants + security review assertions |
| Staff account at AAL1 | student/billing/admin data | stolen password/session | login with first factor only | privileged compromise | TEACHER/SUPPORT/ADMIN policies and server guards require AAL2 for privileged access | RLS tests: Teacher/Admin AAL1 deny, AAL2 allow |
| Browser forges `user_id` | any user-owned record | authenticated client | alter form/JSON identifier | horizontal privilege escalation | server derives actor from `getClaims()`; RLS uses `auth.uid()`; booking/profile services never accept identity as authority | server service code + Student A/B RLS cases |

## MFA decision

TEACHER, SUPPORT and ADMIN access to privileged data requires AAL2. A user may authenticate at AAL1 only far enough to resolve their own roles and complete MFA. The exact break-glass/recovery operating procedure remains an operations decision; it does not weaken the runtime requirement.

## Storage and signed URLs

`yas-protected-assets` is private. There is intentionally no authenticated `storage.objects` upload/download policy in this task. The application first queries the material/lesson asset/recording with the user's JWT so RLS decides access, then a server-only client signs that already-authorized path for at most five minutes.

A signed URL is still a bearer credential until it expires. The residual risk is reduced by short TTL, TLS, private storage and avoiding URL logging; revocation before expiry requires object rotation/removal.

## Provider-dependent controls

The recurring billing provider is still undecided. Its adapter must verify webhook signatures against the **raw request body**, reject stale/invalid signatures where supported, and only then insert the idempotent BillingEvent. Redirects from checkout are never proof of payment.

## Evidence standard

A policy is not accepted by inspection alone. CI recreates two empty PostgreSQL databases, replays every migration/seed and executes every SQL file under `supabase/tests/`. The RLS suite changes database role and JWT claims to prove both positive and negative permissions.
