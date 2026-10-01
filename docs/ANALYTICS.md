# Product Analytics

## Propósito

Medir uso e aprendizagem do produto. Product analytics responde **o que as pessoas fizeram no produto**; não é log técnico, não é sistema de registro transacional e não é audit trail.

A persistência bootstrap continua em `product_analytics_events` via `ProductAnalyticsPort`. O provider definitivo de analytics permanece em [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md), portanto nenhuma feature deve depender diretamente de PostHog ou outro fornecedor.

## Taxonomia oficial inicial

| Evento | Trigger | Propriedades mínimas sugeridas |
| --- | --- | --- |
| `signup_completed` | cadastro realmente concluído | `source` quando conhecido sem PII |
| `login_completed` | sessão autenticada estabelecida | nenhuma obrigatória |
| `subscription_started` | assinatura confirmada pelo provider | `plan_code` |
| `subscription_upgraded` | upgrade confirmado | `from_plan`, `to_plan` |
| `subscription_downgraded` | downgrade confirmado | `from_plan`, `to_plan` |
| `subscription_cancelled` | cancelamento confirmado | `plan_code`, motivo categórico se existir |
| `lesson_started` | aluno inicia uma aula | `lesson_id` |
| `lesson_completed` | aula chega a concluída | `lesson_id` |
| `module_completed` | módulo concluído | `module_id` |
| `practice_started` | prática iniciada | `practice_activity_id` |
| `practice_completed` | prática concluída | `practice_activity_id` |
| `material_opened` | material aberto | `material_id`, tipo |
| `material_favorited` | material favoritado | `material_id` |
| `assessment_started` | tentativa criada/iniciada | `assessment_version_id` |
| `assessment_completed` | tentativa enviada/concluída | `assessment_version_id` |
| `live_session_booked` | booking confirmado | `live_session_id` |
| `live_session_cancelled` | booking cancelado | `live_session_id` |
| `live_session_attended` | presença confirmada | `live_session_id` |

A canonical slice mantém também `lesson_progressed` como evento interno já existente para análise de checkpoints. Ele não substitui `lesson_progress`.

Practice V1 emite `practice_started` e `practice_completed` com `practice_activity_id` e chave idempotente derivada da tentativa. Esses eventos não substituem `practice_attempts`, respostas ou resultados.

## Implementação

- contrato: `PRODUCT_ANALYTICS_EVENTS` em `src/modules/domain/contracts.ts`;
- port: `ProductAnalyticsPort`;
- adapter atual: `src/server/analytics/supabase-product-analytics.ts`;
- sink atual: `product_analytics_events`;
- função autenticada: `track_product_event()`.

Falha de analytics não interrompe uma transação de aprendizagem. A partir do PROMPT 10, a falha deixa de ser silenciosa: ela gera `database_error` na camada de observability com stage `product_analytics.persist`.

`lesson_started`, `lesson_completed` e `module_completed` exigem uma chave idempotente estável derivada do evento e da entidade. O sink aplica unicidade por usuário + chave, portanto refresh, retry concorrente ou repetição após falha não cria uma segunda ocorrência. Eventos curriculares também validam matrícula ativa/conteúdo publicado; conclusão exige progresso persistido antes do evento.

## Privacidade

Não registrar em product analytics:

- senha, token ou secret;
- credencial de pagamento;
- email/telefone como propriedade por conveniência;
- áudio privado;
- resposta sensível de assessment;
- payload bruto de billing.

IDs internos pseudônimos podem ser usados quando necessários ao evento, mas analytics deve carregar somente as propriedades necessárias à métrica.

## Métricas deriváveis

- activation;
- Weekly Active Learners;
- lesson/practice completion;
- booking/attendance/no-show;
- retenção 7/30 dias;
- progressão de curso;
- progressão de assessment;
- Start → Talk / Talk → Boost;
- churn.

“Learning Active User” ainda precisa de definição final antes de virar KPI oficial.

## Invariantes

- Um significado possui um nome de evento estável.
- Evento de analytics não é prova transacional.
- Analytics não substitui progresso, billing, presença ou audit log.
- Propriedades seguem minimização de dados.
- Falha do sink de analytics é observável, mas não quebra a ação principal.

## Interfaces

[OBSERVABILITY.md](./OBSERVABILITY.md) · [AUDIT_LOG.md](./AUDIT_LOG.md) · [PRODUCT.md](./PRODUCT.md) · [SECURITY.md](./SECURITY.md)

## Assessment Engine V1

P19 emite `assessment_started` e `assessment_completed` pelo `ProductAnalyticsPort` existente. As chaves `assessment_started:<attempt_id>` e `assessment_completed:<attempt_id>` são estáveis; o sink com unicidade por usuário + idempotency key elimina duplicata lógica em retry. Analytics não substitui Attempt/Response/SkillScore como source of truth.
