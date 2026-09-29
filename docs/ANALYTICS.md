# Product Analytics

## Propósito
Definir eventos que explicam uso e aprendizagem sem confundir analytics de produto com observabilidade técnica.

## Decisões
Eventos iniciais planejados:
- `signup_completed`
- `login_completed`
- `subscription_started`, `subscription_upgraded`, `subscription_downgraded`, `subscription_cancelled`
- `lesson_started`, `lesson_completed`, `module_completed`
- `practice_started`, `practice_completed`
- `material_opened`, `material_favorited`
- `assessment_started`, `assessment_completed`
- `live_session_booked`, `live_session_cancelled`, `live_session_attended`

Métricas de produto relevantes:
- activation;
- Weekly Active Learners;
- lesson/practice completion;
- booking/attendance/no-show;
- 7/30-day retention;
- course progression;
- assessment progression;
- Start→Talk / Talk→Boost;
- churn/payment failure.

“Learning Active User” pode ser definido futuramente como usuário que realiza ao menos uma ação de aprendizagem significativa na semana; definição final deve ser registrada antes de virar KPI oficial.

## Invariantes
- Evento tem nome/semântica estável e documentação.
- Analytics não é sistema de registro de progresso, billing ou presença.
- PII é minimizada.
- Métrica pedagógica não é inventada a partir de page views.

## O que não fazer
- Eventos duplicados com nomes diferentes.
- Usar session replay sem mascarar dados sensíveis.
- Tomar analytics como prova de ação transacional.
- Registrar respostas/áudio privados sem necessidade explícita.

## Interfaces
[OBSERVABILITY.md](./OBSERVABILITY.md) · [PRODUCT.md](./PRODUCT.md) · [SECURITY.md](./SECURITY.md) · [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md)

## Critérios de aceitação
- Evento futuro possui owner, trigger e propriedades documentadas.
- Métricas críticas podem ser derivadas de eventos consistentes.
- Dados de analytics obedecem princípios de privacidade.
