# ADR 0019 — Notification scheduler via GitHub Actions

## Status

accepted

## Date

2026-10-13

## Context

O outbox `notification_deliveries` só é drenado pela rota autenticada `/api/cron/notifications` (stage 03e). Nada no repositório chamava essa rota, então nenhum e-mail transacional sairia em produção. O host de deploy continua em aberto (OPEN_QUESTIONS), o que impede usar o agendador nativo de um host específico.

## Decision

1. O agendador oficial é o workflow `.github/workflows/notifications-cron.yml`: execução a cada 5 minutos e `workflow_dispatch`, um único `curl` `POST` com `Authorization: Bearer`, sem actions de terceiros e com `permissions: {}`.
2. URL (`PRODUCTION_APP_URL`, obrigatoriamente `https`) e segredo (`NOTIFICATIONS_CRON_SECRET`) ficam no environment dedicado `notifications-cron`, sem required reviewers. O environment `production` do release não é reutilizado.
3. O workflow é fail-closed: se a URL ou o segredo faltarem, ou se a resposta não for `200`, o job falha e fica visível. Nunca há chamada sem autenticação.
4. A rota permanece host-neutral; trocar de agendador quando o host for decidido exige apenas um novo chamador que respeite o mesmo contrato (OPERATIONS.md).

## Alternatives

- Vercel Cron: fecharia a decisão de host antes da hora.
- Supabase `pg_cron` chamando a rota: acopla o banco a uma URL de aplicação e exige extensão de rede no banco.
- Adiar: deixaria a feature 03e sem efeito em produção.

## Consequences

- O GitHub atrasa execuções agendadas em horários de pico e desativa workflows agendados após 60 dias sem atividade no repositório; a operação monitora falhas e reativa o workflow (OPERATIONS.md).
- A latência máxima de envio é cerca de 5 minutos mais o atraso do GitHub. O backoff persistido na delivery torna repetições seguras.
