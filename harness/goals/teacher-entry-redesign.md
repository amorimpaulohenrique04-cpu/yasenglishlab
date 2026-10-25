# GOAL — teacher-entry-redesign

Status: in_progress
Owner: agent/human
Created: 2026-10-23

## Objective / visible result

Redesenhar Entrada seguindo a referência do chat e a implementação de Revisões: fila com KPIs/filtros, evidências por habilidade, resumo/histórico, rascunhos pessoais, notas internas e contrato de assistência IA desativada.

## Context

docs/{UI_CONTRACT,DESIGN_SYSTEM,PLACEMENT,AUTH_RBAC_RLS,SECURITY,ACCESSIBILITY}.md; referência anexada no chat; teacher/revisoes e review-queue.tsx.

## Acceptance criteria

- Fila e detalhe responsivos, CTA violeta, motion reduzido respeitado.
- SLA existente de 24h; nenhum dado pedagógico inventado.
- Rascunhos pessoais com concorrência, notas privadas e finalização imutável.
- IA sem provedor ativo, chamadas pagas ou resultados simulados.

## Allowed files / domains

Rotas teacher/revisoes/placement/**; modules/placement/{ui,domain}/entry-_; server/placement/entry-_; migration aditiva e smoke SQL correspondente; tests/unit/entry-workspace.test.ts; docs de contratos acima; harness desta tarefa. Alterações mínimas no loader placement.ts para evidências tipadas adicionais.

## Forbidden areas

Outras abas, billing, engine de score, CEFR, migrations antigas, produção, alterações preexistentes.

## Scope update — finalização (user feedback)

Incluir src/components/ui/overlays.tsx, src/styles/design-system.css, a story ConfirmationDialog e teste em tests/visual/design-system.spec.ts: corrigir a centralização do Dialog existente (reset CSS removeu margin:auto) e adicionar apresentação semântica de confirmação, sem duplicar primitive. Finalização usa essa apresentação com sucesso verde e ações alinhadas. Não alterar composição de drawers. Teste de regressão escrito para a certificação posterior; sem rodar a suíte agora.

## Validation override (user)

Usuário solicitou validação inicial simples e explicitamente NÃO rodar gates. Conferência focada de código e smoke manual desktop/celular quando ambiente disponível. Certificação verify:agent/ui/security/db/full adiada; manter verified:false.

## Evidence / Done

Registrar checks realmente realizados e limitações em harness/evidence/teacher-entry-redesign e progress.md. Nenhuma certificação ampla será alegada.
