# Architecture

## Propósito
Registrar fronteiras arquiteturais conhecidas sem transformar decisões provisórias em dogma.

## Decisões
Direção atual:
- Frontend/BFF: **Next.js App Router + TypeScript**.
- UI: React; Server Components por padrão e Client Components somente quando interação exigir.
- Persistência/Auth/Storage: **Supabase / PostgreSQL / Supabase Auth / Storage**.
- Autorização: servidor + PostgreSQL Row Level Security.
- Organização por domínio: auth, dashboard, courses, lessons, practice, materials, progress, assessments, schedule, teachers, billing, profile, notifications.
- A apresentação não conversa diretamente com integrações privilegiadas.
- Home e dashboards são read models/projeções de sistemas de registro autoritativos.

```text
UI / routes
   ↓
application / server actions / queries
   ↓
domain services + authorization + DTOs
   ↓
repositories / integrations
   ↓
Postgres · Auth · Storage · providers externos
```

## Invariantes
- Credenciais privilegiadas nunca chegam ao browser.
- Regras de negócio não ficam espalhadas em componentes React.
- Billing, vídeo e meeting ficam atrás de adapters/serviços.
- Dados duráveis possuem sistema de registro autoritativo.
- Decisão estrutural relevante exige ADR em `docs/adr/`.

## O que não fazer
- Componente React chamando provider privilegiado diretamente.
- `service_role` Supabase em Client Component.
- Home mantendo cópia autoritativa de progresso/agendamento.
- Criar abstrações sem necessidade demonstrada.
- Fechar provedor ainda listado em OPEN_QUESTIONS.

## Interfaces
[SECURITY.md](./SECURITY.md) · [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [OPERATIONS.md](./OPERATIONS.md)

## Critérios de aceitação
- Fronteiras e dependências são explícitas.
- Operação privilegiada ocorre no servidor.
- Domínio não depende de detalhes visuais.
- Decisão arquitetural ampla é registrada antes de virar padrão.
