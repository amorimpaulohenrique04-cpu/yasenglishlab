# ADR 0007 — Role-aware workspace routing

## Status

accepted — 2026-10-02

## Date

2026-10-02

## Context

The existing login defaulted to Student Home even for staff, and Student page context did not require the STUDENT role.

## Decision

Resolve login, callback and post-MFA destinations using verified server claims and durable `user_roles`. STUDENT defaults to `/home`, TEACHER to `/teacher`, ADMIN to `/admin/content`. Multiple authorized workspaces require `/workspace` unless a safe, authorized `next` selects one. SUPPORT and accounts without a workspace use `/profile`.

Decode and normalize local paths before authorizing their first segment. Reject protocol-relative paths, backslashes, malformed encoding, control characters and double encoding. Staff AAL2 remains mandatory before workspace selection. Every Student entry uses an explicit STUDENT check independently of navigation.

## Consequences

The selector controls navigation only; server guards and PostgreSQL RLS remain authoritative. MFA completion re-resolves roles. Existing explicit authorized deep links remain valid. Plan labels and editable user metadata never determine roles.

## Alternatives

Silent role precedence would hide valid workspaces. Client-only routing would rely on stale or editable authority. Both were rejected.

## Validation

`tests/unit/auth-routing.test.ts`, `tests/integration/auth-routing.test.ts`, `tests/e2e/workspace-entry.spec.ts` and existing MFA tests cover the boundary.
