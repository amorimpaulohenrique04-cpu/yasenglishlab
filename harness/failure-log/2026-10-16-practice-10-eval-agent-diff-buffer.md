# Failure - eval:agent fails on branches whose diff exceeds 1 MiB

Classification: tool  
Status: resolved  
Repeatable: yes  
Date: 2026-10-16  
PR/commit related: branch feat/practice-10-phase-0 (practice-10-v3)

## Symptom

`npm run verify:full` stopped at `npm run eval:agent` with "Error: git diff --unified=0 origin/main...HEAD failed" and no git error text.

## Evidence

Running the same command directly exits 0 and prints 1,411,957 bytes. `scripts/eval-agent.mjs` reads it through `spawnSync("git", args, { encoding: "utf8" })`, whose default `maxBuffer` is 1 MiB.

## Root cause

When stdout exceeds `maxBuffer`, `spawnSync` stops the child with ENOBUFS and returns a null status, which the helper treats as a git failure. Any branch with a diff above 1 MiB (here the redesign plus practice-10) hits it.

## Responsible layer

Harness tooling (`scripts/eval-agent.mjs`).

## Immediate fix

`maxBuffer: 256 MiB` on the git helper in `scripts/eval-agent.mjs`.

## Permanent protection

The helper no longer depends on the default buffer size; the comment documents why.

## Test/eval created

`npm run eval:agent` on this branch (1.4 MB diff against origin/main), run inside `verify:full`.

## Reproduction

On a branch whose `git diff --unified=0 origin/main...HEAD` is larger than 1 MiB, run `npm run eval:agent`.

## Before/after proof

Before: 2026-10-16 `verify:full` failed at eval:agent with the message above.  
After: see the `verify:full` result recorded in `harness/evidence/practice-10-v3/README.md`.
