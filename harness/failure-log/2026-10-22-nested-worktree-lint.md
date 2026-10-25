# Failure — nested local checkout scanned by root ESLint

Classification: environment
Status: resolved
Repeatable: yes
Date: 2026-10-22
PR/commit related: teacher-sessions-redesign

## Symptom

The root lint gate scanned generated bundles in the preexisting `.level-based-cohorts` Git worktree and produced 26,881 problems (1,852 errors, 25,029 warnings).

## Evidence

The first global lint run reports `.level-based-cohorts/.next-p18/dev/build/chunks/[root-of-the-server]__05i36w1._.js`, including generated CommonJS `require` and `module` assignments. The nested `.git` file points at `.git/worktrees/yasenglishlab`.

## Root cause

The root ESLint configuration already excludes `.claude` local checkouts, but omitted this older local checkout.

## Responsible layer

Local verification file discovery.

## Immediate fix

Add the explicit `.level-based-cohorts/**` global ignore. No product source path or lint rule is disabled.

## Permanent protection

Assert ESLint itself ignores generated nested-worktree paths and still checks the product SessionForm.

## Test/eval created

tests/unit/isolated-next-config.test.ts

## Reproduction

Run npm run lint with the nested checkout and its generated build present, before the exclusion.

## Before/after proof

Before: global lint failed with the counts and generated-file errors above.
After: global ESLint returned exit 0 (one unrelated warning in the existing .stage12-df.config.ts); the real ESLint isolation regression passed in the focused 10-test run. No product source path is ignored.
