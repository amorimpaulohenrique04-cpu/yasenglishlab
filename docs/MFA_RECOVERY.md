# Staff MFA recovery (lost second factor)

Admin and Teacher actions require AAL2. There is **no bypass** in the application and none must be added: no
"skip MFA" flag, no single-account reset, no support-agent override.

## Procedure (break-glass, performed outside the app with a second operator)

1. **Verify identity** of the requester through a channel the platform owner already trusts (for example a
   call-back to a known number). Record who verified, when and how in the incident record.
2. **Second operator.** A different Admin approves the request in writing. One compromised or mistaken account
   must not be able to approve its own recovery. If there is only one Admin, the owner of the Supabase project
   performs step 3 and records the approval.
3. **Reset the factor** in the Supabase dashboard (Authentication → Users → the user → remove the enrolled
   factor). This needs the project owner; it is a dashboard-only capability and is not exposed by this app.
4. **Invalidate sessions** for that user (sign out everywhere) right after the reset.
5. The user signs in with their password (AAL1) and is sent to enrol a new factor before any staff action works.
6. **Audit:** open an incident in `/admin/ocorrencias`-adjacent notes or a ticket in `/admin/suporte` with the two
   approvers and the time. The Supabase auth log keeps the factor removal.
7. If the password may also be compromised, force a password reset first.

## Limits

- This runbook depends on Supabase dashboard access that this repository cannot simulate; the drill is
  `NOT_RUN` (see `docs/GO_LIVE_CHECKLIST.md`).
- Do not store recovery codes or secrets in tickets, evidence files or logs.
