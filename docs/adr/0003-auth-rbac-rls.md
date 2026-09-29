# ADR 0003 — Auth, RBAC, RLS and staff MFA

- Status: Accepted
- Date: 2026-09-29

## Context

PROMPT 05 established durable domain entities but intentionally left public tables deny-by-default under RLS. PROMPT 06 must make browser tampering and direct Supabase calls insufficient to cross authorization boundaries.

## Decision

1. Supabase Auth is the identity provider; SSR sessions use `@supabase/ssr` cookies.
2. Server identity is verified with `auth.getClaims()`; the raw cookie session is not trusted as authorization evidence.
3. Roles are resolved from `public.user_roles`, never from user-editable metadata.
4. TEACHER, SUPPORT and ADMIN require AAL2 for privileged server actions and RLS paths.
5. Teacher access to student data requires an explicit active `teacher_student_assignments` relationship.
6. Student-scoped records use `auth.uid()` ownership or the explicit teacher/staff relationship.
7. Critical tables do not expose direct authenticated mutations. Server services derive actor identity from the verified session and use the service role only after authorization.
8. START/TALK/BOOST remain product data. Paid access is decided by entitlements.
9. Protected materials and recordings live in a private bucket; signed URLs are issued only after an RLS-authorized lookup and expire within 30–300 seconds.
10. Critical role, commercial, booking and progress changes produce append-only audit evidence.
11. Permission policies require automated positive and negative SQL tests.

## Consequences

- Changing React or calling PostgREST directly cannot create admin roles, entitlements, progress or bookings.
- A stolen staff password without a verified second factor does not unlock staff RLS paths.
- The service role remains powerful, so every new service-role function must first establish an authenticated/authorized actor.
- Provider-specific webhook signature verification remains behind the future billing adapter because the provider is not selected.
- MFA recovery/break-glass procedure remains an operational open question; AAL2 enforcement is no longer open.
