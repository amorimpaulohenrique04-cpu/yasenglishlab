# CI/CD e ambientes seguros

## Objetivo

O pipeline oficial do Yas English Lab deve falhar de forma fechada: código só avança quando qualidade, banco, segurança, acessibilidade e regressão visual estão verdes.

Fluxo oficial:

```text
LOCAL → PREVIEW → STAGING → PRODUCTION
```

Nenhum workflow usa secret de produção em Pull Request.

## Ambientes

### LOCAL

Desenvolvimento com Node 24, `npm ci`, Supabase local e `.env.local` fora do Git.

### PREVIEW

Cada PR recebe um ambiente efêmero dentro do GitHub Actions: aplicação + Supabase local isolado + fixture canônica. Esse ambiente executa E2E, acessibilidade e regressão visual sem depender de credenciais de produção.

Hoje o projeto ainda não escolheu um provedor externo de hosting. Por isso PREVIEW é um ambiente isolado de validação e não uma URL pública. Quando o provedor for decidido, o adapter de deploy deve consumir o mesmo commit já aprovado e secrets do environment `preview`.

### STAGING

Após merge em `main`, o workflow `Release` só inicia quando o workflow `Official CI` do mesmo commit termina com sucesso. O job `Staging` promove o manifesto imutável do release no environment `staging`.

### PRODUCTION

O job `Production` depende de `Staging` e usa o environment `production`. Configure esse environment com required reviewer(s) e branch de deployment limitada a `main`.

O repositório ainda não possui Vercel, Railway, Netlify ou outro runtime oficial. O pipeline não inventa um fornecedor. Quando um for escolhido, o comando de deploy deve entrar no job correspondente depois da validação do mesmo `release.json`, sem reconstruir outro SHA.

## Pull Request pipeline

O workflow `.github/workflows/foundation-verify.yml` executa:

1. supply-chain e secret scan;
2. dependency/lockfile policy;
3. install determinístico com `npm ci`;
4. format/lint/typecheck;
5. unit tests;
6. integration tests;
7. migrations em banco limpo + SQL integration/RLS;
8. security/harness checks;
9. production build;
10. critical E2E;
11. accessibility;
12. Storybook visual;
13. golden visual;
14. simulações de falha;
15. `CI Gate`.

Qualquer job obrigatório diferente de `success` derruba `CI Gate`.

## Banco e migrations

Regras obrigatórias:

- schema muda por nova migration em `supabase/migrations`;
- migration já mergeada é imutável;
- nova migration deve usar `YYYYMMDDHHMMSS_slug.sql`;
- timestamp novo deve ordenar depois da migration já mergeada mais recente;
- CI aplica todas as migrations em banco limpo;
- seed roda duas vezes para provar idempotência operacional esperada;
- integration SQL e RLS rodam sobre esse schema;
- o processo é repetido em um segundo banco limpo;
- migration sintaticamente quebrada bloqueia o PR.

Produção não deve ser alterada manualmente no painel como fluxo normal.

## Supply chain

O CI aplica:

- `npm ci` com `package-lock.json`;
- consistência `package.json ↔ package-lock.json`;
- Node 24 fixado por `.nvmrc` e `engines`;
- `npm audit --audit-level=high`;
- Dependency Review em PR;
- secret scanner de alta confiança;
- bloqueio de lifecycle scripts raiz sem revisão;
- heurística para scripts raiz suspeitos;
- GitHub Actions obrigatoriamente fixadas por SHA completo;
- Dependabot semanal para npm e GitHub Actions.

Tokens do workflow ficam em `contents: read`/`pull-requests: read` no CI. Adicione permissões somente no job que realmente precisar delas.

## Simulações executáveis

`Guardrail Simulations` prova quatro cenários em toda execução:

- PR válido: policy, migration policy e secret scan passam;
- teste propositalmente falho: Vitest retorna erro e o cenário só passa se a falha for bloqueada;
- migration inválida: PostgreSQL rejeita e o cenário só passa se a falha for bloqueada;
- secret detectável: scanner rejeita e o cenário só passa se a falha for bloqueada.

Essas falhas são temporárias no workspace do runner e nunca são commitadas.

## Proteção recomendada para `main`

O estado auditado antes deste prompt era `main` sem branch protection/ruleset.

Configurar no GitHub:

- require pull request before merging;
- pelo menos 1 approval quando houver segundo reviewer disponível;
- dismiss stale approvals;
- require conversation resolution;
- require status check `CI Gate`;
- require branch up to date before merge;
- bloquear force push;
- bloquear deletion;
- aplicar também a admins quando operacionalmente viável;
- production environment com required reviewer;
- deployment branch de staging/production limitada a `main`.

A integração usada para este trabalho não possui permissão administrativa para escrever branch protection/environments; essa parte é configuração do repositório, não código.

## Secrets por ambiente

Use secrets separados:

- `preview`: somente credenciais efêmeras ou sandbox;
- `staging`: somente serviços de staging;
- `production`: apenas credenciais de produção.

Nunca copie service-role/database password de produção para PREVIEW.

## Rollback

### Application rollback

Promova novamente o último SHA/release manifest conhecido como saudável. Não altere arquivos manualmente no servidor.

### Database rollback / forward fix

Preferência: **forward fix** com nova migration corretiva. Migration mergeada não é editada.

Rollback SQL só deve existir quando previamente desenhado e testado, especialmente para operações destrutivas. Antes de remoções/renames irreversíveis, use padrão expand/contract, backfill e janela de compatibilidade.

### Feature flag rollback

Features de risco devem, quando aplicável, possuir flag server-side. Em incidente, desative a flag sem remover migration nem reescrever histórico.

## Release gate

Produção só é alcançável quando:

- o commit foi pushado em `main`;
- `Official CI` desse commit terminou verde;
- migrations foram validadas;
- staging concluiu;
- o environment `production` foi aprovado conforme a configuração do GitHub;
- o SHA do `release.json` coincide com o SHA aprovado pelo CI.

## Critérios de aceite

- PR inválido não chega a `CI Gate = success`;
- migrations quebradas falham em banco limpo;
- preview não referencia secrets de produção;
- release usa exatamente o SHA aprovado pelo CI;
- production tem gate próprio;
- rollback está documentado sem prometer rollback destrutivo inseguro.
