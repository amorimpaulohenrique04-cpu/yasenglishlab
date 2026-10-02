# Agent Plan

## Active task

**prompt-21-home-projection-v1**

State: in_progress / verified:false.

Branch: `feat/p21-home-projection-v1`.

### Recovery audit

1. The previous closure was invalid because Harness/evidence said `done / verified:true`
   while the branch head had moved beyond the documented implementation SHA.
2. P21-specific edits to `.github/workflows/foundation-verify.yml` polluted the
   feature scope and could make `eval:agent` observe a different tree from the
   one reported as verified.
3. The Home Schedule read currently filters only booking status. A BOOKED row
   whose `live_sessions.status` is CANCELLED/COMPLETED can still become
   Home's current/future session.
4. The Schedule read is not bounded by time/row count at the database boundary;
   the previous "bounded reads" test proved call count only.
5. The request-scoped auth/client, Learning resume policy, existing Practice
   recommendation and Progress curriculum projection are otherwise kept.

### Correction plan

1. Restore Official CI workflow exactly to `main` and keep P21 Harness
   `in_progress / verified:false` until the final clean head passes.
2. Bound Schedule's Home read at the Schedule repository: own BOOKED booking,
   referenced live session SCHEDULED, `ends_at > now`, order by referenced
   `starts_at`, limit 1.
3. Pass the same explicit `now` from Home application to the Schedule read so
   current/future classification remains deterministic.
4. Add regression coverage for cancelled/completed/ended sessions and for the
   actual bounded repository query, not only repository call count.
5. Extend canonical fixture/E2E so cancelled/completed booked sessions are
   readable but never surface as Home primary/next session.
6. Review `main...branch` for migrations, writes, service-role runtime,
   workflow drift and files outside P21 scope.
7. Run focused tests first, then one final full Official CI on a clean candidate
   head. Only after the implementation head is green may Harness return to
   `done / verified:true`.

### Verification state

Current status: NOT VERIFIED.

Historical green runs remain evidence for their exact historical SHAs only and
must not be used as proof of the eventual final head.

PR #25 must remain open against `main`; no merge is part of P21.
