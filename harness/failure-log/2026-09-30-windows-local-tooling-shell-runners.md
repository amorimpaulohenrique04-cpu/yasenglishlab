# Failure — Windows verification runners depended on unsafe shell dispatch

Classification: tool  
Status: resolved  
Repeatable: yes  
Date: 2026-09-30  
PR/commit related: current change

## Symptom

Direct `spawnSync("npm.cmd", args)` did not provide a reliable Windows execution strategy. Enabling `shell: true` restored some npm calls but split `C:\Program Files\nodejs\node.exe` at the space, produced `'C:\Program' is not recognized`, and emitted Node warning `[DEP0190]` when arguments were passed through the shell.

## Evidence

The clean Windows clone reproduced both failure modes. The pre-fix source used platform-wide shell execution in `verify-core.mjs`, `verify.mjs`, `_verify-utils.mjs`, `verify-full.mjs` and `run-sql-tests.mjs`; `verify-ui.mjs` dispatched `npm.cmd` through the shared helper.

## Root cause

The runners treated the Windows npm command shim and native executables as shell command strings. Shell parsing became responsible for quoting executable paths and arguments even though Node can invoke npm's JavaScript CLI and native executables directly.

## Responsible layer

Verification tooling.

## Immediate fix

All npm runners now execute `process.execPath` with `process.env.npm_execpath` as the first argument. Native tools continue to use direct `spawnSync` with shell execution disabled by default.

## Permanent protection

`scripts/_npm-cli.mjs` centralizes the narrow npm invocation contract. `npm run verify:platform` audits Node verification scripts for `npm.cmd` and explicit shell options, and the harness gate executes this verifier.

## Test/eval created

`scripts/verify-platform.mjs` rejects a controlled Windows red fixture using `C:\Program Files\nodejs\npm.cmd` plus shell, accepts the corrected Node/npm-cli fixture, and executes a real child script from a temporary path containing spaces with shell metacharacters passed literally.

## Reproduction

Run the controlled red fixture in `npm run verify:platform`; it models the prior Windows command specification and must be rejected for shell use, `.cmd` dispatch and missing npm CLI entrypoint.

## Before/after proof

Before: the controlled old invocation is rejected for all three unsafe properties and matches the reproduced path-splitting/DEP0190 failure class.  
After: the corrected fixture and real path-with-spaces probe pass, and all audited verification scripts contain neither `.cmd` npm dispatch nor child-process shell configuration.
