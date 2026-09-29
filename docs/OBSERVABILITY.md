# Observability

## Propósito
Permitir reconstruir falhas técnicas e operações relevantes sem depender apenas do relato do usuário.

## Decisões
Separar:
- product analytics → comportamento de uso;
- observability → saúde e trajetória técnica;
- audit log → ação privilegiada/administrativa durável.

Sinais previstos:
- structured logs;
- error reporting;
- request correlation;
- metrics;
- traces quando apropriado.

Erros que devem ser distinguíveis quando os domínios existirem:
- `booking_conflict`
- `video_access_failed`
- `assessment_submit_failed`
- `billing_webhook_failed`
- `database_error`
- `permission_denied`

Contexto técnico útil: request_id, environment, version, timestamp e user reference minimizada quando necessário.

## Invariantes
- Senha, token, credencial de pagamento e secret não entram em logs.
- Observabilidade não substitui audit trail.
- Uma execução crítica deve ser correlacionável entre fronteiras.
- Retries e side effects precisam ser observáveis/idempotentes.

## O que não fazer
- Logs em texto livre sem contexto quando estrutura é possível.
- Registrar payload sensível inteiro “para debug”.
- Usar analytics como log de auditoria.
- Engolir exceção sem sinal técnico.

## Interfaces
[ANALYTICS.md](./ANALYTICS.md) · [SECURITY.md](./SECURITY.md) · [OPERATIONS.md](./OPERATIONS.md) · [LIVE_CLASSES.md](./LIVE_CLASSES.md)

## Critérios de aceitação
- Para falha crítica é possível identificar etapa, ambiente e evidência.
- Alertas futuros se baseiam em sinais úteis, não ruído.
- Audit log de ação privilegiada permanece separado e durável.
