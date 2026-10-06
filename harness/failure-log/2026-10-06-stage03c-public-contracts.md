# Stage 03C public projection and accessibility

Classification: ui contract. Status: resolved locally; Official CI pending. Final canonical run: 1 passed (26.0s).

Red evidence: canonical commercial E2E axe reported CTA foreground #32125f on #6d28d9, contrast 2.13:1. The new nav link selector overrode the approved Button's foreground. Scoped the rule to non-button links. The same axe checks at desktop/tablet/mobile passed after the correction; the canonical test remains a permanent guard. Linked evidence: harness/evidence/stage-03c-public-commercial-flow/README.md. PR pending.

A second deterministic projection failure was a strict RFC UUID validator against existing PostgreSQL seed IDs (10000000-0000-0000-0000-000000000001). No DB data was rewritten. z.guid validates the database identifier format; the focused integration fixture now uses that seed shape and passed. Auth and newly generated checkout UUID validation remains strict.

The permanent canonical guard also requires new interactive links to have 44px width/height. It caught the Entrar link at 41.84px width; scoped min-width and touch-link rules fixed it. The unchanged scenario then passed at every required viewport.

Environment interruption: the E2E screenshot write failed with ENOSPC while the same dev server emitted Turbopack SST persistence failures. Removed only regenerable workspace dev cache after stopping that server, then retried only this E2E. No wider environment repair or unrelated test investigation.
