# GOAL — teacher-availability-redesign

Status: in_progress
Owner: agent/human
Created: 2026-10-23

## Objective / visible result

Disponibilidade conforme referência do chat: KPIs, grade domingo–sábado selecionável, formulário/presets, lista alinhada, recorrência até data definida e pausa, edição de uma ocorrência ou futuras. Preservar sessões agendadas e integração em Sessões.

## Context

docs/LIVE_CLASSES.md, UI_CONTRACT.md, DESIGN_SYSTEM.md, AUTH_RBAC_RLS.md, SECURITY.md, ACCESSIBILITY.md. Implementações teacher/disponibilidade, Sessões e Revisões existentes.

## Acceptance criteria

- Intervalos legados seguem ativos; calendário/URL, desktop/celular e motion reduzido.
- Lote atômico/idempotente, prazo máximo de um ano e data final obrigatória; autoria TEACHER+AAL2.
- Pausa/edição/exclusão nunca retiram cobertura de sessões agendadas.
- Sem gates/build/suítes amplas; registrar validação inicial e certificação adiada.

## Allowed scope

teacher/disponibilidade/**; modules/teacher-operations/{domain,ui}/availability-_; server/teacher-operations/availability-_; migration aditiva, smoke SQL e testes unitários focados; adaptação mínima das projeções/comandos compartilhados de disponibilidade em SQL e schemas; docs/LIVE_CLASSES.md, AUTH_RBAC_RLS.md, UI_CONTRACT.md; harness desta tarefa.

## Forbidden

Produção, reset do banco, migrations antigas, reservas/entitlements, cancelamentos e experiência do aluno, alterações preexistentes, commit/push.

## Scope refinement

Adicionar somente ícones sun/moon ao conjunto Icon existente para os presets da referência, sem criar primitive duplicada. Scripts de aplicação/smoke restritos a localhost ficam na pasta de evidência desta tarefa.

## Validation override

Pedido explícito: somente checks focados e smoke/local browser; NÃO executar verify:*, build ou suítes amplas neste primeiro momento. Manter verified:false e certificação ampla pendente.

## Evidence / Done

Evidência e resultados reais em harness/evidence/teacher-availability-redesign/. Preservar blockers e diferenças intencionais documentadas.

Entrega inicial implementada. SQL, UI e checks focados concluídos; veja progress.md e evidence/teacher-availability-redesign/. Certificação completa adiada pelo usuário, verified:false. Não executar gates/build nesta etapa.
