# Mux private video — homologation checklist

Mux is the chosen provider for course video that must not expose a shareable link (ADR 0011). Unlisted
YouTube is **not** acceptable for this requirement and no client-side workaround is provided.

Local contract coverage (fake provider, no credentials): `tests/integration/mux-provider.test.ts`,
`tests/integration/mux-webhook-route.test.ts`, `tests/e2e/recorded-video.spec.ts`.

The steps below need real Mux credentials and have **not** been run. Status values: `NOT_RUN_EXTERNAL` until a
person with the Mux account executes them and records evidence under `harness/evidence/`.

| # | Step | Expected | Status |
|---|---|---|---|
| 1 | Admin creates a direct upload for a lesson asset | Upload URL issued; asset row `UPLOADING` | NOT_RUN_EXTERNAL |
| 2 | Upload a small MP4 | Mux webhook `video.asset.ready` marks the asset `READY` (signature verified) | NOT_RUN_EXTERNAL |
| 3 | Admin publishes the lesson | Student with access sees the player | NOT_RUN_EXTERNAL |
| 4 | Student plays the video | Playback uses a **signed**, expiring token; no public playback id in page source | NOT_RUN_EXTERNAL |
| 5 | Wait for token expiry, replay the copied URL | Playback denied | NOT_RUN_EXTERNAL |
| 6 | Student without access (no paid access / other course / pending cohort decision) requests playback | Denied by the server before any token is issued | NOT_RUN_EXTERNAL |
| 7 | Send a webhook with a bad signature | Rejected, nothing persisted | NOT_RUN_EXTERNAL |
| 8 | Delete/replace the asset | Old playback ids stop working | NOT_RUN_EXTERNAL |

Required secrets are server-only: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`,
`MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY_BASE64`.
