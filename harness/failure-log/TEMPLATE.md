# Failure — <short title>

Classification: <context | tool | environment | state | architecture | security | ui contract | test gap | observability | permission | dependency | agent behavior>  
Status: <open | resolved | accepted-risk>  
Repeatable: <yes | no>  
Date: <YYYY-MM-DD>  
PR/commit related: <URL, SHA or current change>

## Symptom

What visibly failed?

## Evidence

Logs, screenshot, command output, trace, test result or reproducible observation.

## Root cause

What underlying condition produced the failure?

## Responsible layer

Which layer owns the cause: application, database, UI, CI, harness, environment, dependency, permission, agent behavior, or another explicit boundary?

## Immediate fix

What restored the task or system now?

## Permanent protection

What guard prevents the same failure class from silently returning? Use None — <reason> only when Repeatable is no.

## Test/eval created

Which test, eval, scanner, visual baseline or invariant proves the protection? Use None — <reason> only when Repeatable is no.

## Reproduction

Minimal deterministic reproduction steps or command.

## Before/after proof

Before: <evidence that the failing case is rejected or reproduced>  
After: <evidence that the corrected case passes>
