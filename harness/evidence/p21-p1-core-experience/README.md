# P21.4–P21.6 evidence

Base: `78c4c689b6fbabde56083b417e7bbbfc9e302ccb`. Branch: `feat/p21-p1-core-experience`.

See [REPORT.md](REPORT.md) for observed checks and remaining work. Execution stopped at user request; implementation is partial and verified:false. Real Mux smoke is unverified.

## Status update (2026-10-13)

Stays `in_progress / verified:false`. The only remaining blocker is the real Mux smoke recorded in `RECONCILIATION-2026-10-03.md` (upload, playback and captions against a non-production Mux environment, following `docs/P21_CORE_EXPERIENCE.md`). The webhook was hardened since (bounded body read, 204 for old unknown assets), but synthetic contracts do not replace the real provider run. It needs non-production Mux credentials supplied by the operator.
