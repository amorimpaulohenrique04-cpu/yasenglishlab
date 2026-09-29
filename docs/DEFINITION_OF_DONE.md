# Definition of Done

## Propósito
Uma feature só termina quando comportamento, visual, autorização, estados, testes e evidência terminam juntos.

## Decisões
Checklist-base:
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

## Invariantes
- “Funciona na minha máquina” não é conclusão.
- UI aprovada não pode regredir silenciosamente.
- Segurança não é opcional por a feature ser “pequena”.
- Teste falhando bloqueia declaração de sucesso até resolução ou blocker documentado.

## O que não fazer
- Marcar done por inspeção visual única.
- Omitir estados de erro/loading.
- Declarar RLS correta sem teste quando houver política.
- Fazer mudança de contrato sem atualizar fonte de verdade.

## Interfaces
[TESTING.md](./TESTING.md) · [UI_CONTRACT.md](./UI_CONTRACT.md) · [SECURITY.md](./SECURITY.md) · [ACCESSIBILITY.md](./ACCESSIBILITY.md) · [PERFORMANCE.md](./PERFORMANCE.md)

## Critérios de aceitação
- O checklist aplicável é verificável por evidência.
- Exceções são explicitamente justificadas e registradas.
- “Done” significa comportamento final observável, não somente código escrito.
