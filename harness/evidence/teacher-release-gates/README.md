# Teacher release gates — 2026-10-24

Status: delivery in progress; release unverified. No release approval or all-green claim.

## Scope and decisions

Branch `codex/teacher-sessions-redesign`, initial HEAD `7d32666`. A fetch confirmed the initial branch contains 35 commits / 563 changed files against `origin/main`, including earlier work. New commits remain on this branch; no auto-merge is authorized.

Current work covers runtime screenshot isolation, availability target geometry, and failures proved by the gates. Proposals/reference downloads under `artifacts/` are ignored per user choice; the four previously tracked approved HTML files remain versioned. Earlier regenerated evidence PNGs are preserved locally and left outside staging. Only reviewed before/after captures are committed for this task.

## Agents

- `diagnostico`: read-only log, code and semantic review; no database or port operations.
- `gates`: command-only executor, `gpt-6-luna`; no source edits.
- `frontend`: UI, screenshot helper and Playwright changes.
- `banco`: dedicated unbooked session fixture; preserved reservation immutability.
- Main: coordination, state, evidence review, commits and delivery. Source writers worked sequentially.

## Verification ledger

| Check                                               | Result                          | Observed evidence                                                                             |
| --------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| Production builds, before and after UI fix          | PASS                            | Next compilation, TypeScript, 54 static pages; dynamic routes included                        |
| Focused unit regression                             | PASS                            | 2 files, 6 tests: unique runtime captures, propagated write errors, target geometry           |
| Availability before                                 | Expected FAIL                   | Fixed 2099-10-24 22:40–23:40 session; free target 14.890625 px                                |
| Availability after                                  | PASS                            | Same fixture: >=24 px, axe WCAG 2.2 AA and composer selection 23:45; 1 passed, exit 0         |
| First combined capture-spec run                     | FAIL / incomplete teardown      | Reporter emitted 5 PASS and 2 FAIL; no final JSON. See focused-observations.json              |
| Teacher practices focused rerun                     | PASS                            | JSON expected=1, unexpected=0, skipped=0, duration 317163.8 ms; exit 0                        |
| Sessions split scenarios                            | PASS                            | JSON expected=5, unexpected=0, skipped=0, flaky=0; exit 0, 6.6 min total                      |
| verify:security                                     | PASS                            | 504 source files inspected                                                                    |
| verify:db                                           | PASS                            | Structural check: 74 migrations, seed and 54 SQL invariant files; not executable SQL evidence |
| verify:harness                                      | PASS after documentation repair | Required headings restored; no guard disabled                                                 |
| eval:agent                                          | FAIL                            | After 6e6296c, skip rule passes; one rule still rejects six new primitives                    |
| verify:agent and final Prettier CLI                 | NOT RUN                         | Pending focused browser completion                                                            |
| verify:ui (complete official browser/visual suites) | NOT RUN                         | Pending                                                                                       |
| SQL integration + RLS after clean reset             | NOT RUN                         | Pending; host psql, local port 55322                                                          |
| verify:full                                         | NOT RUN                         | Final release gate pending; includes another reset                                            |

## Before/after and limitations

Reviewed `availability-before.png` and `availability-after.png` show the same fixed session. The initial fixture attempt was correctly rejected with SQLSTATE 23514 because it tried to move a reserved session. The corrected fixture inserts and deletes its own unbooked session without changing RLS, triggers or migrations. The target-size record is resolved at commit `ca16dd5`.

Hour rows use an 80 px base and grow for shorter vertical gaps. A one-minute gap can require 1560 px per hour; this follows the user's chosen larger-row interaction. The proof concerns free vertical cell fragments, not every possible overlap or lane width.

Screenshot diagnosis found writable existing files and no persistent lock or demonstrated Windows-security cause. Unique runtime files avoid overwriting tracked evidence; write errors remain fatal. All 22 Sessions captures and all Teacher-practices compositions completed without UNKNOWN. The underlying transient environment cause remains unproved.

The first practices navigation failure did not recur in the focused rerun; no cause or fix is claimed. Temporary sanitized diagnostics were removed. The other-Teacher authorization error emitted late in the passing test is the expected negative case.

The original aggregate Sessions case spent 167 seconds between its first and last screenshots before exhausting the 180-second budget at the CSV request. Commit `f10c45a` splits scenario/viewport/export responsibilities while preserving every capture, axe scan and assertion, without increasing the existing budgets.

Manual review found no functional duplicates in the six primitives; see `semantic-review.md`. The automatic evaluator remains unchanged and has no input to accept this review, so its result remains FAIL.

## Runtime and evidence hygiene

Node 24.19.0 / npm 11.17.0 work through the installed Node npm CLI; the broken roaming shim was avoided without changing the installation. Local Docker required authorized execution. C: initially had about 11 GiB free. The vector service was observed restarting; no service change was made at preflight.

Playwright shutdown was slow. The first combined cleanup mistakenly selected its shell wrapper with a broad command-text filter and lost the JSON report. Later cleanup tracked exact Next descendants and preserved the reporter: the practices rerun produced valid JSON and exit 0, and ports 3000/3001 were confirmed free. No teardown code fix is claimed.

No environment files, tokens, service keys or raw Supabase status are stored here. Generated Playwright reports stay in ignored runtime artifacts; this ledger contains sanitized results.

## User-directed handoff to GitHub — 2026-10-25

After the five Sessions cases passed, the user explicitly moved the remaining complete checks to GitHub and requested push/PR now. The large local verify:agent, verify:ui, executable SQL and verify:full runs are NOT RUN by this instruction, not PASS.

CI now runs independent checks after unrelated failures while preserving actual installation/database/build prerequisites and the final failing aggregate. The Preview matrix also includes the literal verify:full release command; its failure does not suppress the independent DB/E2E/a11y/visual entries. SQL executes remaining files/concurrency cases after a failing case and fails at the end. Runtime evidence is sanitized before upload; authentication-bearing trace archives are excluded.

Targeted validation of these CI changes: PASS, 4 Vitest files / 32 tests; repository/lockfile/pinned-Actions policy PASS. Complete GitHub results remain pending.

## Delivery and CI trigger

PR #89: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/89 (draft, no auto-merge). GitHub reports merge conflicts with main across16 files; pull_request checks were not scheduled. A dry merge-tree inspection changed no checkout files or migrations. Official CI is therefore also triggered by push to codex/teacher-sessions-redesign, testing the requested branch directly. Release remains restricted to successful main pushes. Domain merge conflicts remain explicit pending work; they were not resolved by choosing one side blindly.
