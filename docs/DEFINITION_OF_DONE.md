# Definition of Done

## Propósito

Uma feature só termina quando comportamento, visual, autorização, estados, testes e evidência terminam juntos.

## Checklist-base

- comportamento atende critérios de aceitação;
- desktop, tablet e mobile revisados quando a feature é visual;
- loading, empty, error, disabled e success cobertos quando aplicáveis;
- keyboard, focus, semântica e contraste revisados;
- autorização server-side/RLS considerada;
- validação server-side considerada;
- testes proporcionais ao risco;
- analytics/observability incluídos quando aplicáveis;
- performance revisada;
- nenhum secret/dado sensível vazado;
- documentação/ADR atualizados quando a mudança altera contrato;
- evidência final produzida.

## Gates obrigatórios

A escolha mínima é proporcional ao risco, mas um task não pode ser marcado `done` enquanto um gate aplicável estiver vermelho.

- lógica pura: unit;
- application/Server Action/boundary: integration;
- DB/persistência: integration SQL;
- auth/RLS: RLS real com caso negativo;
- fluxo crítico: E2E;
- UI: a11y + screenshot/golden;
- conclusão por coding agent: `npm run eval:agent`;
- release-grade / mudança transversal: `npm run verify:full`.

O registry só pode usar `status: done` + `verified: true` quando existir evidência de verificação compatível com o GOAL.

## Invariantes

- “Funciona na minha máquina” não é conclusão.
- UI aprovada não pode regredir silenciosamente.
- Segurança não é opcional por a feature ser “pequena”.
- Teste falhando bloqueia declaração de sucesso até resolução ou blocker documentado.
- Atualizar snapshot/golden sem revisar a diferença não conta como correção.
- Falha detectada automaticamente deve terminar com exit code diferente de zero.
- Um warning nunca substitui um gate obrigatório.

## O que não fazer

- Marcar done por inspeção visual única.
- Omitir estados de erro/loading.
- Declarar RLS correta sem teste executável.
- Fazer mudança de contrato sem atualizar fonte de verdade.
- Adicionar `.skip` ou enfraquecer expectation para obter CI verde.
- Declarar sucesso com Git/CI diferente do relatório.

## Interfaces

[TESTING.md](./TESTING.md) · [UI_CONTRACT.md](./UI_CONTRACT.md) · [SECURITY.md](./SECURITY.md) · [ACCESSIBILITY.md](./ACCESSIBILITY.md) · [PERFORMANCE.md](./PERFORMANCE.md)

## Critérios de aceitação

- O checklist aplicável é verificável por evidência.
- Exceções são explicitamente justificadas e registradas.
- “Done” significa comportamento final observável, não somente código escrito.
