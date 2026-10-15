# PR 74 — gates

Status: in_progress.

Baseline CI: run 38816615381; E2E 1265 s (8 failed/29 passed), a11y 299 s (5 failed/1 flaky/28 passed), visual goldens 3 failed no login; preparação Supabase 121–136 s por suíte.

Linux: candidatos do run 38824369683 (12/12 gerados), revisados no contact sheet local e contra a linguagem visual aprovada. Diferenças intencionais: Inter/Montserrat, shell roxo, heros, novos cards, módulos recolhíveis; login herda tipografia/tokens. Tolerância de 0.0015 preservada. Workflow temporário de candidatos removido após a revisão; o gate oficial continua comparando PNGs versionados.
