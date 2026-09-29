# ADR 0002 — Domain contracts and initial relational model

- Status: Accepted
- Date: 2026-09-29

## Context

Yas English Lab já possui contratos de produto, billing, assessment, live classes, materiais e arquitetura, mas ainda não possuía schema executável. Features futuras poderiam criar campos incompatíveis, misturar progresso com proficiência, autorizar por nome de plano ou permitir overbooking.

## Decision

1. PostgreSQL/Supabase é a fonte de verdade do modelo durável.
2. Zod/TypeScript define contratos de fronteira e tipos compartilhados; UI não é implementada nesta etapa.
3. `auth.users` permanece a identidade principal; `profiles` complementa a identidade sem duplicar credenciais.
4. START/TALK/BOOST são **dados em `plans`**, não branches de autorização.
5. Acesso funcional é descrito por `entitlements` e `plan_entitlements`.
6. Não usamos PostgreSQL ENUM agora; estados delimitados usam CHECK constraints.
7. Assessment é versionado e versões publicadas/usadas são imutáveis.
8. Booking serializa concorrência por lock da linha de `live_sessions` antes de validar capacidade.
9. BillingEvent usa chave idempotente `provider + event_id` e preserva payload histórico.
10. Todas as tabelas públicas nascem com RLS ligado, mas policies detalhadas ficam para a etapa de Auth/RBAC/RLS.

## Consequences

### Positive
- domínio não depende da UI;
- plano novo não exige condicionais espalhadas;
- CEFR não pode ser confundido estruturalmente com percentual do curso;
- overbooking passa a ser uma responsabilidade do banco;
- tentativas de assessment permanecem auditáveis contra uma versão exata;
- migrations/seeds podem ser reproduzidos em ambiente vazio.

### Trade-offs
- quotas consumidas por período ainda exigirão um serviço de entitlement/balance antes da UI de booking;
- RLS está deny-by-default até a tarefa de autorização;
- providers de billing e vídeo continuam atrás de interfaces futuras.

## Rejected alternatives

- autorização por `plan.code` em componentes;
- uma coluna genérica `progress` para curso e CEFR;
- editar assessment publicado in-place;
- verificar capacidade somente no navegador;
- usar PostgreSQL ENUM para todo estado mutável.
