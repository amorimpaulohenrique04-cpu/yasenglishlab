# Operations

## Propósito

Definir princípios operacionais para ambientes, migrations, backup, incidentes e mudanças seguras.

## Ambientes oficiais

LOCAL → PREVIEW → STAGING → PRODUCTION.

O contrato executável está em [CI_CD.md](./CI_CD.md).

- **LOCAL** usa Next.js + Supabase local.
- **PREVIEW** sempre possui caminho efêmero isolado no CI; deploy remoto é opcional e não recebe production secrets.
- **STAGING** usa infraestrutura e secrets próprios.
- **PRODUCTION** usa infraestrutura e secrets próprios e exige release gate.

## Database operations

Mudanças de banco são versionadas em `supabase/migrations/`.

Regras:

- migration aplicada é histórica e imutável;
- nova mudança = nova migration;
- CI reproduz migrations em banco vazio;
- staging/production fazem dry-run antes de push;
- seeds nunca são aplicados automaticamente em production;
- mudanças destrutivas seguem expand/contract;
- rollback normal de banco é forward fix;
- restore de backup/PITR é procedimento de incidente, não deploy cotidiano.

## Deploy operations

GitHub Actions é o control plane oficial.

Production exige SHA em `main`, CI verde, PR mergeado/revisado, release gate `APPROVE`, approval do Environment `production` e migrations validadas.

O provider de hosting continua reversível. O adapter atual de CI/CD é Vercel, sem fechar a decisão registrada em `OPEN_QUESTIONS.md`.

## Rollback

- **application:** redeploy/promover último artefato saudável somente se compatível com o schema atual;
- **database:** forward fix por migration; backup/PITR para incidente de dados;
- **feature flag:** kill switch server-side por ambiente, quando aplicável.

Detalhes em [CI_CD.md](./CI_CD.md).

## Backups e incidentes

Backups precisam de restore testável; “ter backup” sem restore conhecido é insuficiente.

Runbooks mínimos: falha de pagamento; booking inconsistente/overbooking; indisponibilidade de reunião/vídeo; incidente de segurança; restore de dados; assessment interrompido.

## Invariantes

- Mudança de schema deixa migration revisável.
- Operação manual privilegiada é excepcional e auditável.
- Secrets não atravessam ambientes por conveniência.
- Incidente registra timeline/evidência suficiente.
- Restore é exercitado, não apenas presumido.
- Production release é reproduzível a partir de um SHA.

## O que não fazer

- Alterar schema de produção clicando no painel como fluxo normal.
- Compartilhar production secrets com preview/staging.
- Corrigir entitlement diretamente sem registrar motivo/evidência.
- Editar migration histórica para “consertar” produção.
- Bypassar CI/review como fluxo normal.

## Interfaces

[CI_CD.md](./CI_CD.md) · [SECURITY.md](./SECURITY.md) · [OBSERVABILITY.md](./OBSERVABILITY.md) · [TESTING.md](./TESTING.md) · [ROADMAP.md](./ROADMAP.md)

## Critérios de aceitação

- Processo de mudança é reproduzível.
- Runbooks críticos existem antes do lançamento correspondente.
- Backup/restore e incident response possuem owners quando a equipe for definida.
- CI/CD bloqueia release quando gates obrigatórios falham.
