# Architecture Decision Records

Use ADR only for architecturally relevant decisions with durable consequences. Do not register trivial implementation choices.

Start new records from [TEMPLATE.md](./TEMPLATE.md). The required decision fields are:

- Status
- Date
- Context
- Decision
- Alternatives
- Consequences

## Rules

- Do not rewrite an accepted ADR to hide a changed decision; create a new ADR and mark the previous one superseded.
- OPEN_QUESTIONS.md records what is not decided yet.
- Domain documents describe the current architecture.
- Failure records belong in `harness/failure-log/`; use an ADR only when a failure exposes a durable architectural decision.

## Records

- [0001 — Foundation stack](./0001-foundation-stack.md)
- [0002 — Domain contracts](./0002-domain-contracts.md)
- [0003 — Auth, RBAC and RLS](./0003-auth-rbac-rls.md)
- [0004 — Provider-neutral observability boundary](./0004-provider-neutral-observability-boundary.md)
- [0005 — Failure-to-guard engineering ratchet](./0005-engineering-ratchet.md)
- [0006 — Admin Content V1 publication](./0006-admin-content-publication.md)
- [0007 — Role-aware workspaces](./0007-role-aware-workspaces.md)
- [0008 — Transactional live usage](./0008-transactional-live-usage.md)
- [0009 — Cohort compatibility](./0009-cohorts-compatible-scope.md)
- [0010 — Human Practice Review V1](./0010-human-practice-review-v1.md)
- [0011 — Mux recorded course video](./0011-mux-recorded-course-video.md)
- [0012 — Provider-neutral Live Operations and Meeting Access](./0012-provider-neutral-live-operations.md)
