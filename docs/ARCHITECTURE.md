# Architecture

Admin Content V1 follows UI → application/domain/ports → server-only authenticated adapter → narrow Postgres RPCs. It edits the same Student content entities; publication/RLS/audit are durable database boundaries. See [ADMIN_CONTENT.md](./ADMIN_CONTENT.md) and ADR 0006.

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


## Canonical Vertical Slice

PROMPT 07 define a implementação de referência que features futuras devem copiar **na estrutura**, não no conteúdo. O fluxo executável é:

```text
Login
  → /home
  → /aulas
  → módulo
  → aula
  → checkpoint de progresso
  → logout
  → novo login
  → retomada do checkpoint persistido
```

### Camadas oficiais

```text
UI
src/app/(protected)/(student)/*
src/modules/learning/ui/*
        ↓
application
src/modules/learning/application/queries.ts
src/modules/learning/application/commands.ts
        ↓
domain
src/modules/learning/domain/*
        ↓
ports
LearningRepository · ProductAnalyticsPort
        ↓
adapters server-only
src/server/learning/supabase-learning-repository.ts
src/server/analytics/supabase-product-analytics.ts
        ↓
authorization + persistence
Supabase Auth · RLS · record_lesson_progress()
        ↓
PostgreSQL
lesson_progress · product_analytics_events
```

Pages não constroem dados duráveis e não conhecem SQL/RPC. Elas chamam casos de uso da camada application. Application depende de ports; Supabase é adapter.

### Progress contract

`lesson_progress` persiste `lesson_id`, `user_id`, `completion_percent`, `last_position_seconds` quando aplicável, `last_accessed_at`, `completed_at` e os demais timestamps/status necessários.

O client nunca envia `user_id`. O RPC autenticado `record_lesson_progress()` deriva `auth.uid()`, valida matrícula ativa para a aula e impede reassignment dos campos de identidade. `UPDATE lesson_progress` direto continua negado para `authenticated`. O percentual é monotônico: checkpoint antigo não reduz progresso já salvo.

A posição de retomada também é monotônica. A conclusão de aula deriva de `completion_percent = 100`; a conclusão de módulo exige um módulo não vazio com todas as aulas em 100%. Esses estados persistidos, e não a Home ou analytics, são a fonte de verdade.

### Analytics

A slice implementa `login_completed`, `lesson_started`, `lesson_progressed` e `lesson_completed`. Analytics fica atrás de `ProductAnalyticsPort` e nunca é fonte de verdade do progresso.

O learning core inclui também `module_completed`. Os eventos críticos de início/conclusão usam idempotency keys estáveis e são validados contra identidade, matrícula, publicação e progresso persistido no boundary do banco.

### UI e estados

A slice compõe somente primitives existentes: `AppShell`, `Sidebar`, `Topbar`, `ContentContainer`, `PageHeader`, `Button`, `Card`, `ProgressBar`, `Skeleton`, `EmptyState` e `ErrorState`.

Estados explícitos: loading pelo route-group `loading.tsx`; empty sem matrícula ativa; success com dados do seed; error por `error.tsx`; unauthorized para conta não-Student ou recurso fora da matrícula ativa.

A direção visual segue as referências aprovadas de Home/Aulas: navegação roxa profunda, canvas lilás, superfícies brancas arredondadas, baixa densidade e amarelo reservado para ação prioritária. O CI captura desktop, tablet e mobile em `canonical-slice-visual-evidence` para comparação visual.

### Evidência

- Unit: cálculo de progresso e transição de conclusão.
- Integration: `supabase/tests/vertical_slice_persistence.sql` chama o RPC real e prova retomada persistida.
- RLS: Student A/B não leem progresso um do outro e mutação direta da tabela continua negada.
- E2E: Supabase local real executa login → aula → 50% → logout → login → 50% restaurado → conclusão.
- Visual: screenshots Home/Aulas desktop e Home tablet/mobile são publicados pelo CI.

### Regra para domínios futuros

Uma nova vertical slice deve criar o menor domínio/port necessário, implementar adapter server-only, aplicar autorização no boundary de persistência, instrumentar analytics atrás de port e provar comportamento com unit/integration/RLS/E2E conforme o risco. Não consultar persistência privilegiada em Client Components nem copiar primitives do design system dentro da feature.

## Invariantes
- Credenciais privilegiadas nunca chegam ao browser.
- Regras de negócio não ficam espalhadas em componentes React.
- Billing, vídeo e meeting ficam atrás de adapters/serviços.
- Dados duráveis possuem sistema de registro autoritativo.
- Decisão estrutural relevante exige ADR em `docs/adr/`.
- `user_id` fornecido pelo browser nunca é autoridade para write autenticado.

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

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.
## Transactional notification delivery

Billing aplicado → notifications → notification_deliveries → processor server-only → NotificationDeliveryProvider (Resend/Fake). Dedupe local, claim bounded e retry independentes do estado comercial. Recipient vem de Auth; scheduler permanece aberto. Ver [ADR 0014](adr/0014-resend-transactional-email.md).
