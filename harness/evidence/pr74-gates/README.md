# PR 74 — gates

Status: in_progress.

Baseline CI: run 38816615381; E2E 1265 s (8 failed/29 passed), a11y 299 s (5 failed/1 flaky/28 passed), visual goldens 3 failed no login; preparação Supabase 121–136 s por suíte.

Linux: candidatos do run 38824369683 (12/12 gerados), revisados no contact sheet local e contra a linguagem visual aprovada. Diferenças intencionais: Inter/Montserrat, shell roxo, heros, novos cards, módulos recolhíveis; login herda tipografia/tokens. Tolerância de 0.0015 preservada. Workflow temporário de candidatos removido após a revisão; o gate oficial continua comparando PNGs versionados.

Controles locais: 18 testes de gates passaram (6.36 s): formatação versionada, relatórios vazios/ausentes/globais, falha/skip/flaky, validação após falha do subprocesso e agregador fail-closed.

### Encerramento solicitado pelo usuário — 2026-10-15

Correções publicadas na PR #74, HEAD 0f67200f2b9934a924f8ef3e559274d181ea7f19. Execução local final interrompida a pedido do usuário para encerrar a tarefa; verify:ui e verify:full não concluídos. CI 38827166316: Quality, Supply Chain, Database e Guardrail Simulations aprovados; quatro suítes Preview em execução na última consulta. Não há comprovação de todos os gates obrigatórios verdes; tarefa permanece não verificada.

## Retomada após CI 38827166316

Quality, Supply Chain, Database, Guardrails, a11y, database-proofs e visual passaram. E2E: 35 passaram/2 falharam em 2,5 min (antes: 21,1 min). Correções restritas à infraestrutura e expectativas de teste: retenção de todos os chunks antes da hidratação; projeto comercial em dev isolado preservando o bloqueio FAKE em produção. Configuração e contratos comerciais: 7 testes aprovados; typecheck e contrato do harness aprovados. A primeira reprodução local passou hidratação e webhook; navegação final para onboarding excedeu 5 s devido à compilação inicial e recebeu limite explícito de 20 s, como os outros redirecionamentos comerciais. Confirmação e CI final pendentes.

Confirmação local: os dois E2E falhos passaram integralmente, zero retries, em 1,7 min; typecheck, lint dos arquivos alterados, 7 unitários e verify:harness aprovados. CI do novo commit pendente.
