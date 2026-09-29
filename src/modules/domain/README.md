# Domain contracts

PROMPT 05 formaliza o vocabulário compartilhado do Yas sem implementar UI nem application services.

- `contracts.ts`: schemas Zod e tipos das entidades principais.
- `entitlements.ts`: contrato de saldo de entitlement e regra pura de acesso.
- `index.ts`: superfície pública do módulo.

## Regras

- UI e server actions importam contratos daqui; não recriam versões locais.
- `plan.code` identifica produto, não autorização.
- progresso curricular e proficiência CEFR permanecem tipos distintos.
- valores vindos de DB, webhooks, forms ou providers devem ser validados na fronteira adequada.
- detalhes de persistência continuam em Supabase/Postgres; estes schemas são contratos de aplicação, não um ORM.
