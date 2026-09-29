# Observability

## Propósito

Permitir responder sem depender do relato do usuário:

- **O que aconteceu?**
- **Com quem?**
- **Em qual request?**
- **Qual etapa falhou?**
- **Qual impacto houve?**

## Três sistemas, três responsabilidades

| Sistema | Pergunta principal | Persistência bootstrap |
| --- | --- | --- |
| Product analytics | O que a pessoa fez no produto? | `product_analytics_events` |
| Observability | O que aconteceu tecnicamente com a execução? | JSON estruturado + `observability_events` para erros |
| Audit log | Quem executou uma ação privilegiada/relevante durável? | `audit_logs` append-only |

Não misturar os três. Ver [ANALYTICS.md](./ANALYTICS.md) e [AUDIT_LOG.md](./AUDIT_LOG.md).

## Contexto de correlação

Todo erro técnico persistido carrega:

- `request_id`;
- `trace_id`;
- `span_id`;
- `user_id` pseudônimo quando necessário;
- `environment`;
- `version`;
- `stage`;
- `impact`;
- `timestamp`.

`proxy.ts` gera um novo `request_id` por request e propaga `x-request-id` e `x-trace-id` para o App Router e para a resposta. O código server-only recupera esse contexto por `getRequestTechnicalContext()`.

## Structured logs

Schema lógico atual: `yas.technical.v1`.

Exemplo sanitizado:

```json
{
  "log_schema": "yas.technical.v1",
  "eventName": "technical_error",
  "errorCode": "database_error",
  "requestId": "…",
  "traceId": "…",
  "spanId": "…",
  "environment": "preview",
  "version": "<commit-sha>",
  "stage": "product_analytics.persist",
  "impact": "degraded"
}
```

Spans server-side de operações críticas emitem `span_started` e `span_completed` com duração e o mesmo trace. Erros dentro do span produzem um `technical_error` persistido.

## Error reporting

Códigos oficiais iniciais:

- `booking_conflict`;
- `video_access_failed`;
- `assessment_submit_failed`;
- `billing_webhook_failed`;
- `database_error`;
- `permission_denied`.

Nem todos os domínios já têm feature implementada. Os códigos de assessment/billing permanecem reservados para os boundaries correspondentes; não foram criadas features fictícias só para emitir eventos.

Instrumentação real já conectada:

- falha ao persistir analytics → `database_error`;
- booking conflitante → `booking_conflict`;
- falha genérica de booking → `database_error`;
- acesso negado por role/MFA → `permission_denied`;
- falha de asset/recording protegido → `video_access_failed` ou `permission_denied`;
- falha ao persistir audit log → `database_error` com impacto `data_integrity_risk`;
- role change privilegiado → span correlacionado.

## Sink atual e limite conhecido

O bootstrap grava erros técnicos em `observability_events` com RLS sem acesso direto a `anon`/`authenticated`. A tabela é append-only.

Também há structured log sempre. Isso é importante porque uma indisponibilidade total do mesmo banco pode impedir a gravação do evento no sink; nesse cenário o JSON do runtime continua sendo a evidência primária.

A stack externa definitiva de error reporting/tracing continua deliberadamente aberta em [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md). Quando Sentry/OpenTelemetry/outro collector for escolhido, ele deve entrar atrás do mesmo boundary `ObservabilitySink`, sem misturar com analytics/audit.

## Privacidade e redaction

O sanitizer server-only mascara/descarta:

- password;
- token/JWT/authorization/cookie;
- API keys/secrets/credentials;
- payment/card/CVV;
- private audio;
- assessment responses/answer keys;
- emails e telefones em strings livres.

Não registrar signed URL, storage path privado ou payload bruto de billing.

## Dashboards mínimos sugeridos

1. **Error health** — contagem/taxa por `error_code`, `stage`, ambiente e versão.
2. **Release health** — erros por `version` antes/depois de cada release.
3. **Learning critical path** — `database_error` nos stages de auth/learning/analytics.
4. **Live classes** — `booking_conflict` por janela e sessão, sem PII.
5. **Authorization** — `permission_denied` por stage/role requerida, observando abuso sem transformar negativa normal em incidente.

## Alerts iniciais sugeridos

Valores abaixo são baseline operacional inicial e devem ser recalibrados com tráfego real:

- qualquer `critical` em produção → alerta imediato;
- `database_error >= 5` em 5 min na mesma versão/stage → alerta;
- `billing_webhook_failed >= 1` em produção → alerta quando billing existir;
- `assessment_submit_failed >= 3` em 10 min → alerta quando assessment submit existir;
- `video_access_failed >= 5` em 10 min no mesmo stage → alerta;
- aumento abrupto de `booking_conflict` acima da linha de base → investigação de capacidade/concurrency.

`permission_denied` isolado é normalmente sinal de controle funcionando, não incidente.

## Teste intencional executável

`tests/integration/observability-live.test.ts`:

1. cria um `database_error` intencional;
2. passa pelo reporter real;
3. grava no Supabase isolado de Preview;
4. consulta `observability_events` pelo mesmo `request_id`;
5. confirma código, stage, impacto, ambiente, versão, trace/span;
6. grava evidência sanitizada em `artifacts/observability/intentional-error.json`.

O workflow `Official CI → Preview` executa esse teste antes dos E2E.

## Invariantes

- Senha/token/secret/credencial de pagamento nunca entra em logs.
- User ID técnico, quando usado, é o UUID interno; email não substitui identidade.
- Observability não substitui audit trail.
- Analytics não substitui observability.
- Um erro crítico possui código, stage, impacto e correlação.
- Falha do sink de observability não engole a exceção original nem impede structured log.

## Interfaces

[ANALYTICS.md](./ANALYTICS.md) · [AUDIT_LOG.md](./AUDIT_LOG.md) · [SECURITY.md](./SECURITY.md) · [OPERATIONS.md](./OPERATIONS.md) · [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)
