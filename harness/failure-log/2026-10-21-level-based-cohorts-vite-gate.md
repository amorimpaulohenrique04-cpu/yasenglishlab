# Failure — Vite advisory blocked required CI gates

Classification: dependency

Status: resolved

Repeatable: yes

Date: 2026-10-21

PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/88

## Symptom

Supply Chain failed on unreviewed Vite 8.3.1 advisories and blocked every downstream job.

## Evidence

CI run 39620533896, Supply Chain job 119292474452. Local supply-chain-final.log and supply-chain-final.exit=0 after the lock patch.

## Root cause

The existing lock selected Vite 8.3.1. Launch-editor advisories affect Vite 8.3.0 through 8.3.2.

## Responsible layer

Existing dev dependency resolution in package-lock.json.

## Immediate fix

Lock only Vite 8.3.3 to official npm tarball/integrity and its Rolldown range; already locked Rolldown 1.2.11 satisfies it. No package is added and no policy changes.

## Permanent protection

The existing fail-closed supply-chain audit continues rejecting unreviewed findings. Production audit remains clean; the separately reviewed braces source patch and its byte/exploit checks remain required.

## Test/eval created

Reuse npm run verify:supply-chain and npm run verify:dependency-patches; no parallel scanner or advisory exception is introduced.

## Reproduction

Run npm run verify:supply-chain with the main lockfile, then with the Vite lock patch.

## Before/after proof

Before: CI run 39620533896 failed with Unreviewed audit finding: vite.
After: the unchanged local verify:supply-chain exits 0, reporting production audit clean and only the existing reviewed braces chain. Final CI replay remains pending.
