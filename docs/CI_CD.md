# CI/CD & Environment Contract

## Propósito

GitHub Actions é o control plane oficial de CI/CD do Yas English Lab. Os contratos de ambiente são provider-neutral. O repositório inclui um adapter Vercel reversível para deployment remoto, mas isso **não fecha** a decisão de hosting registrada em `OPEN_QUESTIONS.md`.

## Ambientes

| Ambiente | Aplicação | Dados | Secrets | Entrada normal |
| --- | --- | --- | --- | --- |
| LOCAL | Next.js local | Supabase local | `.env.local`, nunca commitado | desenvolvimento |
| PREVIEW | runner isolado sempre; Vercel opcional | Supabase local efêmero; remoto só quando configurado | Environment `preview`, nunca production | PR com CI verde |
| STAGING | projeto de deploy dedicado | projeto Supabase dedicado | Environment `staging` | `main` com CI verde |
| PRODUCTION | projeto de deploy dedicado | projeto Supabase dedicado | Environment `production` | workflow manual + release gate |

### Infraestrutura remota atual

No momento da implementação do PROMPT 09, as contas Vercel e Supabase conectadas não possuíam projetos Yas English Lab. Nenhum recurso cobrável foi criado automaticamente.

Por isso:

- todo PR continua recebendo preview seguro e efêmero dentro do runner;
- `External Preview Adapter` só roda com `YAS_EXTERNAL_PREVIEW_ENABLED=true`;
- staging só roda com `YAS_STAGING_DEPLOY_ENABLED=true`;
- production falha se `YAS_PRODUCTION_DEPLOY_ENABLED` não for `true` ou faltar credencial;
- habilitar deploy remoto exige projetos e secrets separados por ambiente.

## Pull Request pipeline

`.github/workflows/ci.yml` executa gates paralelos e um `PR Gate` agregado:

1. **Supply Chain** — `npm ci --ignore-scripts`, lockfile/versões, lifecycle allowlist, Actions pinadas por SHA, secret scan, environment isolation e `npm audit`.
2. **Quality** — instalação determinística, format, lint, typecheck, unit, integration, security, build, harness/evals e inventário UI.
3. **Database & RLS** — disciplina/imutabilidade de migrations, dois replays completos em bancos vazios, seed idempotente, integration SQL e policies RLS reais.
4. **Critical E2E** — Supabase local real e vertical slice canônica.
5. **Accessibility & Visual** — axe, keyboard/focus/landmarks, Storybook visual e golden Login/Home/Aulas.
6. **PR Gate** — exige `success` explícito de todos os gates anteriores.

Push para `main` ainda executa `Full Verification`, reusando a cadeia integrada do PROMPT 08.

## Banco e migrations

A fonte de verdade é `supabase/migrations/*.sql`.

Regras obrigatórias:

- schema novo exige migration;
- migration já existente em `main` é imutável;
- migration nova usa `YYYYMMDDHHMMSS_slug.sql` e timestamp posterior ao histórico;
- SQL de schema não pode ficar espalhado fora dos locais aprovados;
- migrations precisam aplicar em banco vazio;
- seed precisa ser idempotente;
- staging/production fazem `supabase db push --dry-run` antes de `supabase db push`;
- produção não usa `--include-seed`;
- alteração manual no Dashboard não é fluxo normal; drift emergencial deve ser reconciliado em migration revisada.

Para mudanças destrutivas, usar **expand/contract**: adicionar estrutura compatível → publicar app compatível → migrar/backfill → observar → remover estrutura antiga em migration posterior.

## Preview

### Preview sempre disponível

Depois de `Yas CI` verde em PR, `.github/workflows/preview.yml` faz checkout do SHA verificado, sobe Supabase local limpo, aplica migrations/seed, builda, inicia `next start` e exige `/login` saudável. O ambiente morre com o runner e não usa production secrets.

### Preview externo opcional

O adapter Vercel é desabilitado por padrão e só roda para PRs do próprio repositório. Configuração:

- repository variable: `YAS_EXTERNAL_PREVIEW_ENABLED=true`;
- GitHub Environment: `preview`;
- secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`;
- o projeto de preview deve usar apenas dados/Supabase não-prod.

## Staging

Ativação: `YAS_STAGING_DEPLOY_ENABLED=true`.

GitHub Environment `staging` precisa de:

- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- `SUPABASE_PROJECT_ID`;
- `VERCEL_TOKEN`;
- `VERCEL_ORG_ID`;
- `VERCEL_PROJECT_ID`.

O workflow só parte de `main` com `Yas CI` verde. Faz dry-run das migrations, aplica migrations pendentes, confirma migration history, builda e publica no projeto Vercel dedicado de staging.

## Production

Production não é automática após push. O operador usa `workflow_dispatch` com:

- `release_sha=<SHA completo de 40 caracteres>`;
- `release_gate=APPROVE`.

O `Release Gate` exige:

- SHA ancestral de `origin/main`;
- `Yas CI` verde para o SHA;
- PR mergeado associado ao SHA;
- review `APPROVED` por alguém diferente do autor do PR;
- input `APPROVE`.

Depois, o job entra no GitHub Environment `production`, que deve exigir reviewer humano.

Ativação: `YAS_PRODUCTION_DEPLOY_ENABLED=true`.

Secrets do Environment `production` usam os mesmos nomes de staging, mas valores próprios de production. O release roda supply-chain novamente, dry-run de migrations, aplica somente migrations versionadas, confirma migration history, builda e publica o artefato production.

## Supply-chain security

### Dependências e lockfile

- `npm ci` é obrigatório;
- `package-lock.json` v3 é autoritativo;
- dependências diretas usam versões exatas;
- runtime high/critical vulnerabilities bloqueiam CI;
- critical vulnerabilities no conjunto completo bloqueiam CI.

### Lifecycle scripts

Allowlist atual revisada:

- `esbuild@0.28.2`;
- `fsevents@2.3.3` (optional);
- `unrs-resolver@1.12.2`.

Novo package/version com install script bloqueia o gate até revisão explícita.

### GitHub Actions

Toda Action externa deve usar commit SHA completo de 40 caracteres, nunca somente major/tag.

### Secrets

`npm run ci:secrets` detecta formatos de GitHub PAT, Supabase secret key, Vercel credentials, AWS access key, private keys e arquivos `.env*` commitados fora de `.env.example`.

## Mínimo privilégio

Workflows normais usam `permissions: contents: read`. Production acrescenta somente `actions: read` e `pull-requests: read` para validar o release gate. Não existe `contents: write` no pipeline oficial.

Tokens Vercel/Supabase ficam no GitHub Environment correspondente, devem ter escopo mínimo ao projeto e não atravessar ambientes.

## Branch protection recomendada

O GitHub App conectado não possui permissão administrativa para configurar branch protection, e nenhum ruleset estava visível no repositório durante a implementação. Configurar `main` com:

- require pull request before merge;
- pelo menos 1 approval;
- dismiss stale approvals;
- require review from CODEOWNERS;
- require conversation resolution;
- required status check `PR Gate`;
- opcionalmente exigir também `Supply Chain` e `Database & RLS`;
- require branch up to date before merge;
- bloquear force push e branch deletion;
- bypass somente break-glass explícito e auditável.

`.github/CODEOWNERS` define o owner inicial.

## GitHub Environments

### preview

Somente credenciais não-prod do adapter de preview. Nunca copiar production secrets.

### staging

Secrets próprios e deployment branch `main`.

### production

Secrets próprios, deployment branch `main`, required reviewer e prevenção de self-review quando a configuração/plano permitir.

## Rollback

### Application rollback

Selecionar último SHA/deployment saudável e confirmar compatibilidade com o schema atual antes de promover/republicar. Se o banco avançou de forma incompatível, fazer hotfix forward-compatible em vez de rollback cego.

### Database rollback / forward fix

O padrão é **forward fix por nova migration**. Não editar migration aplicada e não depender de down migration automática em produção. Em perda/corrupção de dados: interromper writers quando necessário, usar backup/PITR como incidente e reconciliar migration history antes de reabrir writes.

### Feature flag rollback

Features de risco devem possuir kill switch server-side por ambiente antes do release. Flag apenas visual/client-side não é rollback de autorização ou regra de negócio. Enquanto provider de flags não for escolhido, flags operacionais ficam atrás de configuração server-side documentada.

## CI simulations

`.github/workflows/ci-simulations.yml` prova sem deixar código inválido commitado:

1. **Valid PR** — gates normais retornam zero.
2. **Failing Test Blocked** — unit test falso temporário precisa retornar não-zero.
3. **Invalid Migration Blocked** — SQL inválido temporário precisa quebrar replay limpo.
4. **Detectable Secret Blocked** — token falso em runtime precisa quebrar secret scan.

As três simulações inválidas só são consideradas corretas quando o detector falha e o wrapper confirma essa falha.

## Provider adapter

O adapter remoto usa `vercel@59.20.0` pinado nos workflows. Isso não resolve a pergunta “hosting definitivo”; trocar provider deve exigir apenas substituir os passos de deployment e atualizar este contrato/ADR.

## Critérios de aceitação

- PR inválido não alcança `PR Gate` verde.
- Migration quebrada não chega a staging/production.
- Preview nunca precisa de production secrets.
- Production não publica sem CI, review, migrations e approval gate.
- Deploy remoto desconfigurado falha ou permanece explicitamente desabilitado.
- Rollback não depende de editar migration histórica.
