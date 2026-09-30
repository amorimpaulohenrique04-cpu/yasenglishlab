# Failure — Windows checkout converted repository text to CRLF

Classification: environment  
Status: resolved  
Repeatable: yes  
Date: 2026-09-30  
PR/commit related: current change

## Symptom

A clean Windows checkout reported `i/lf w/crlf`, and `npm run format:check` failed for approximately 175 files because Prettier requires LF.

## Evidence

The reproduced checkout failed formatting with CRLF worktree files. Reconfiguring Git and recloning produced `i/lf w/lf`, after which the same formatting check passed. The repository had no `.gitattributes`, so checkout behavior depended on each developer's Git configuration.

## Root cause

The repository declared Prettier's LF requirement but did not declare the corresponding Git checkout attribute. Windows `core.autocrlf` could therefore materialize tracked LF text as CRLF.

## Responsible layer

Repository environment policy.

## Immediate fix

Added `.gitattributes` with `* text=auto eol=lf` and explicit binary asset exclusions.

## Permanent protection

Git now normalizes repository text to LF independently of developer configuration. `npm run verify:platform`, executed by the harness gate, checks representative text attributes through `git check-attr`.

## Test/eval created

`scripts/verify-platform.mjs` asserts `eol: lf` and `text: auto` for representative documentation, JavaScript and JSON files.

## Reproduction

Without `.gitattributes`, clone with Windows line-ending conversion enabled and run `git ls-files --eol` followed by `npm run format:check`.

## Before/after proof

Before: the reproduced clone showed `i/lf w/crlf` and formatting failed across approximately 175 files.  
After: `npm run verify:platform` confirms the versioned LF policy and the required formatting gate passes with `i/lf w/lf` files.
