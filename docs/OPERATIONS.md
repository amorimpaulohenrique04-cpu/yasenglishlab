# Operations

## Propósito
Definir princípios operacionais para ambientes, migrations, backup, incidentes e mudanças seguras antes de o produto existir em produção.

O processo executável de CI/CD está em [CI_CD.md](./CI_CD.md).

## Decisões
Ambientes oficiais:
```text
LOCAL → PREVIEW → STAGING → PRODUCTION
```

Mudanças de banco devem ser versionadas em migrations. Produção não é ambiente de experimentação manual.
Preview/staging não devem reutilizar secrets privilegiados de produção.
Backups precisam de procedimento de restore testável; “ter backup” sem restore conhecido é insuficiente.
Features de risco elevado devem admitir rollback/disable quando possível.

O CI valida migrations em banco limpo, bloqueia edição de migrations já mergeadas e executa integração/RLS reais. O release só avança a partir do SHA aprovado pelo CI.

Runbooks mínimos futuros:
- falha de pagamento;
- booking inconsistente/overbooking;
- indisponibilidade de reunião/vídeo;
- incidente de segurança;
- restore de dados;
- assessment interrompido.

## Invariantes
- Mudança de schema deixa migration revisável.
- Migration mergeada é imutável; correção usa nova migration.
- Operação manual privilegiada é excepcional e auditável.
- Incidente registra timeline/evidência suficiente para aprendizado posterior.
- Restore é exercitado, não apenas presumido.
- Produção recebe somente release associado a CI verde.

## O que não fazer
- Alterar schema de produção clicando no painel como fluxo normal.
- Compartilhar secrets entre ambientes por conveniência.
- Corrigir entitlement diretamente sem registrar motivo/evidência.
- Prometer rollback de migration destrutiva sem estratégia real.
- Fazer deploy de um SHA diferente do que passou no CI.

## Interfaces
[CI_CD.md](./CI_CD.md) · [SECURITY.md](./SECURITY.md) · [OBSERVABILITY.md](./OBSERVABILITY.md) · [TESTING.md](./TESTING.md) · [ROADMAP.md](./ROADMAP.md)

## Critérios de aceitação
- Processo de mudança é reproduzível.
- Runbooks críticos existem antes do lançamento correspondente.
- Backup/restore e incident response possuem owners quando a equipe for definida.
- Branch protection e environments do GitHub refletem os gates descritos em CI_CD.md.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

## Agendamento do processor de notificações

O outbox de e-mails (`notification_deliveries`) só é drenado por `GET`/`POST /api/cron/notifications`. O host de deploy ainda é decisão aberta (ADR 0014, OPEN_QUESTIONS); o agendador oficial é o workflow `.github/workflows/notifications-cron.yml` (ADR 0019), independente do host.

Configuração obrigatória antes do lançamento (operador):

1. No host, defina `NOTIFICATIONS_CRON_SECRET` (regras abaixo).
2. No GitHub, crie o environment `notifications-cron` **sem required reviewers** e cadastre nele o secret `NOTIFICATIONS_CRON_SECRET` (mesmo valor) e a variável `PRODUCTION_APP_URL` (`https://…`, sem barra final). Não use o environment `production` do release: o gate de aprovação travaria cada execução.
3. Rode o workflow uma vez por `workflow_dispatch` e confira `HTTP 200` e as contagens no log.

O workflow roda a cada 5 minutos, falha visivelmente se a URL ou o secret faltarem (ou se a URL não for `https`) e nunca chama a rota sem autenticação. Limitações conhecidas do GitHub Actions: execuções agendadas podem atrasar em horários de pico, e o GitHub desativa workflows agendados após 60 dias sem atividade no repositório. Monitore falhas do workflow e reative-o se for desativado.

- Defina `NOTIFICATIONS_CRON_SECRET` (aleatório, 32+ caracteres, distinto de todos os outros secrets) no ambiente server-only. Ausente, curto ou reutilizado, a rota responde `503` e não processa.
- O agendador chama a rota a cada 1–5 minutos com `Authorization: Bearer <secret>`. Sem header válido: `401`.
- Cada chamada processa um lote fixo (20); a resposta traz apenas contagens (`claimed/sent/pending/failed/lost`). Claim com lease torna chamadas concorrentes ou repetidas seguras; o backoff é persistido na delivery.
- Não registre o secret em logs do agendador; rotacione trocando o valor no host e no agendador.

## Content readiness report

`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/content-readiness.sql` lists published content that is
incomplete (empty courses/modules/lessons, assets without body or source, materials without a file, practices
without content, welcome-flagged items that Students cannot open). It is read-only. Missing production
content must be authored in Admin Content; the system never invents lessons.
