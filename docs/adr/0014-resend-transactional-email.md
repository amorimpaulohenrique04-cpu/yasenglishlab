# ADR 0014 — Resend transactional email

## Status

accepted

## Date

2026-10-06

## Context

Billing aplicado precisa gerar notificações duráveis sem depender de envio externo. notifications permanece fonte do estado de notificação; entrega operacional exige dedupe, concorrência e retry independentes.

## Decision

Resend é o provider autorizado para EMAIL transacional, atrás de NotificationDeliveryProvider. Native fetch usa POST https://api.resend.com/emails, Bearer server-only, User-Agent explícito, sender fixo RESEND_FROM_EMAIL e Idempotency-Key derivada da delivery. Resposta aceita contém somente message id. Nenhum SDK/framework de email é necessário.

Uma migration aditiva gera três templates V1 a partir de evento Billing aplicado: mirror com timestamp/prioridade/status correspondentes e audit billing_reconciled do mesmo event_id. O audit distingue STALE com timestamp/prioridade iguais. Não alterar o reconciler 3B.

notifications.dedupe_key e unique(notification_id,channel) são autoridade local. notification_deliveries mantém o outbox server-only. Claim bounded SKIP LOCKED, lease e token de fencing; máximo cinco attempts com backoff persistido, sem sleep. SENT é terminal. A aceitação pelo provider não é prova de chegada à caixa de entrada.

Resend mantém idempotency por 24 horas e exige payload igual. Retries usam a mesma chave; templates V1 são determinísticos. Não recuperar automaticamente um envio incerto após 23 horas da primeira tentativa: FAILED com código sanitizado, evitando reenvio fora da janela. Falhas/crashes deixam lease recuperável dentro dessa janela. Alteração de recipient/sender que resulte em conflito de payload é permanente, sem gerar chave nova.

Recipient vem de Auth Admin por user_id durável, com email confirmado. Fake somente test/local explicitamente configurado e nunca production; production sem Resend configurado falha antes do claim. Não há endpoint público de processamento.

## Alternatives

Nenhum outro provider foi comparado: Resend foi autorizado. Fetch foi escolhido por cobrir o contrato sem dependência adicional. Invocação/scheduler ficam para a decisão posterior de hosting.

## Consequences

Provider failures não alteram Subscription, Placement ou BillingEvent. Outbox é criado atomicamente com o evento durável, sem chamadas externas no trigger. Não se promete exactly-once entre PostgreSQL e provider; fencing, dedupe local e janela limitada cobrem concorrência e recuperação sem reenvio automático tardio.

Configurar domínio remetente verificado, API key com escopo de envio, invocador confiável e monitoramento operacional antes de produção. Push, WhatsApp, marketing, UI, webhooks Resend e tracking de bounce ficam fora desta slice.

Documentação oficial consultada em 2026-10-06: [POST /emails](https://resend.com/docs/api-reference/emails/send-email), [autenticação/User-Agent/limites](https://resend.com/docs/api-reference/introduction), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [erros](https://resend.com/docs/api-reference/errors). 429/5xx/transporte são temporários; 409 concurrent_idempotent_requests/resource_locked temporários; request/auth/rejeição permanente e 409 invalid_idempotent_request permanentes. Sender/recipient/HTML/URL não vêm do browser.
