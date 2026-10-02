# ADR 0012 — Provider-neutral Live Operations and Meeting Access

**Status:** Accepted  
**Date:** 2026-10-02

## Context

P21.4 turns Live from a read/attendance surface into a Teacher-operated domain. Teachers need to create and edit availability and sessions, Students need cancel/rebook and Join, and meeting credentials must remain outside browser-readable session projections. The first production workflow must work before a Zoom/Google Meet-specific integration is chosen.

The existing Live domain already owns session identity, booking identity, quota snapshots, cohort scope, cancellation and attendance. Replacing those contracts with a meeting-provider model would duplicate authority and weaken the P21.1–P21.3 security boundaries.

## Decision

Live Operations stays provider-neutral.

- V1 meeting provider is `MANUAL_EXTERNAL`: a Teacher may attach one validated HTTPS meeting URL.
- `MeetingProviderPort` is the application boundary for resolving provider access. Future Zoom/Meet adapters must implement that boundary rather than changing Live domain identity.
- Teacher authority always derives from `auth.uid() -> teachers.user_id`; browser input never supplies authoritative `teacher_id`.
- Privileged Teacher commands require durable `TEACHER` plus AAL2.
- Group sessions require a currently authorized Cohort. Private sessions require one authorized target Student and no Cohort.
- Teacher availability is durable data. Session creation/edit must be fully contained in an availability interval.
- Session overlap is a database invariant and is serialized on the Teacher row. Adjacent sessions remain valid.
- Booking identity, commercial usage snapshots, quota and existing cancel/rebook commands remain authoritative.
- Meeting provider/reference metadata is server-only. General authenticated table grants and Agenda/Teacher DTOs omit `meeting_ref`.
- Join is a separate server-authorized operation. Student access requires an own BOOKED reservation; Teacher access requires ownership and AAL2.
- The V1 Join window is configured in `private.live_join_policy`: 15 minutes before start through 15 minutes after end.
- Join returns state (`NOT_AUTHORIZED`, `TOO_EARLY`, `MEETING_NOT_READY`, `AVAILABLE`, `SESSION_CLOSED`) and exposes the URL only for `AVAILABLE`.

## Alternatives

1. **Expose meeting URLs in `live_sessions`/Agenda.** Rejected because read access would become credential access and revocation/window rules could not be enforced at Join time.
2. **Build directly around Zoom or Google Meet.** Rejected because provider lifecycle would become domain authority and make migration unnecessarily invasive.
3. **Build WebRTC in-product.** Rejected for V1; it introduces a separate realtime media platform unrelated to the current learning-domain goal.
4. **Store availability only in UI/calendar state.** Rejected because session validity and concurrent writes require a database invariant.

## Consequences

- V1 can ship with manual meeting links without committing the domain to one vendor.
- A future provider adapter may create/refresh meetings while preserving existing session, booking and authorization IDs.
- Meeting links cannot be discovered through normal Data API reads; every Join is re-authorized against current session/booking/role state.
- Availability and overlap rules can reject writes that older fixtures previously allowed. Test fixtures must therefore respect production invariants at every intermediate state.
- Provider-specific recordings remain outside Live Operations; recorded course video continues under ADR 0011.
