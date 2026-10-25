# Teacher release gates — 2026-10-24

Status: in progress. No release approval or all-green claim.

## Scope

Branch `codex/teacher-sessions-redesign`; initial HEAD `7d32666`. Local comparison with `origin/main` includes 35 commits / 563 files, including earlier work. Initial HEAD matches the remote branch.

Current fixes: screenshot output isolation and availability target geometry. Existing regenerated PNGs are preserved; only selected reviewed evidence is staged. Untracked proposal/reference directories are ignored per user decision; approved tracked HTML remains versioned.

## Agents

- `diagnostico`: read-only filesystem/log and historical eval inspection.
- `gates`: command-only executor, `gpt-6-luna`; no source edits.
- `frontend`: single source writer for UI, Playwright and screenshot helper.
- Main: coordination, scope/state, evidence review and delivery.

## Results so far

| Check                       | Result                | Evidence                                                                                                                                |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Node / npm                  | PASS                  | Node 24.19.0; npm 11.17.0 through installed Node npm CLI; broken roaming shim avoided without installation edits                        |
| Port preflight              | PASS                  | 3000/3001 free before focused run                                                                                                       |
| Production build before fix | PASS                  | Next compilation, TypeScript and 54 static pages generated; dynamic routes included                                                     |
| Docker preflight            | PASS with observation | Local stack reachable with authorized execution; vector container restarting; no service changes                                        |
| Screenshot diagnosis        | Partial               | Destination open failed historically; ACL/path/read-only/permanent locks not reproduced; no evidence attributing it to Windows security |
| Remaining mandatory gates   | NOT RUN               | Pending source completion and focused regression                                                                                        |

No environment files, tokens, service keys or raw Supabase status are stored in evidence.

## Deterministic before proof

Production build at initial HEAD, dedicated fixed session on 2099-10-24 22:40–23:40: free target height was 14.890625px, rejected by the same regression requiring at least24px. Capture reviewed: availability-before.png. Initial fixture attempt failed before UI with SQLSTATE23514 because it tried to move a reserved session; fixture was corrected to insert/delete its own unbooked session, preserving the immutable reservation guard.

## Focused non-browser checks

- PASS: 2 unit files /6 tests (capture-screenshot and availability-grid-geometry).
- PASS: verify:security (504 source files inspected).
- PASS: verify:db (74 migrations, seed and54 SQL invariant files, structural check only).
- FAIL then document corrected, rerun pending: verify:harness rejected missing required headings in the new screenshot-open failure record. No guard was disabled.

Current commits: f54cb7e (capture isolation), ca16dd5 (availability geometry and fixed fixture).
