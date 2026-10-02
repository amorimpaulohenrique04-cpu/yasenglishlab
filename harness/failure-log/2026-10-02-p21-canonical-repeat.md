# Failure — Canonical Admin reorder left the next run with a position conflict

Classification: state  
Status: resolved
Repeatable: yes  
Date: 2026-10-02  
PR/commit related: current change — feat/p21-p0-foundation-closure

## Symptom

A second UI run rejected creating the canonical module at position 2; Getting Started still occupied that position after the previous Admin reorder test.

## Evidence

The failed browser URL was `/admin/content/new?kind=modules&error=unavailable`. A PostgreSQL read confirmed `Getting Started|2|PUBLISHED`. Setup removed the temporary module but did not restore the surviving canonical module order.

## Root cause

Canonical fixture reset restored publication and account state but omitted the order changed by a successful existing Admin test.

## Responsible layer

Local canonical fixture preparation.

## Immediate fix

Restore only the known canonical module to position 1 through DRAFT, order update, PUBLISHED transitions. Keep all publication guards. Do not change the Admin mutation assertion or approved golden baselines.

## Permanent protection

Setup deterministically resets canonical module order; repeated verify:ui and verify:full invoke it again after Admin mutations.

## Test/eval created

The existing Admin Content E2E and following canonical learning E2E exercise this lifecycle; all mutations and expected positions remain checked.

## Reproduction

Run Admin E2E, prepare the canonical fixture again and repeat Admin E2E.

## Before/after proof

Before: position 2 conflict and the unavailable browser response were observed on repeat.

After: repeated final UI/full browser runs passed all 14 E2E, including Admin reorder and subsequent fixture reset. Literal verify:ui is green; see verify-ui.log.
