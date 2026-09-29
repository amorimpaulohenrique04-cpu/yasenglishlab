# ADR 0002 — GitHub Actions as CI/CD control plane

Status: accepted  
Date: 2026-09-29

## Context

O Yas precisa de CI/CD seguro antes de escolher definitivamente todos os providers de infraestrutura. O repositório já usa Next.js, Supabase e um harness de testes completo. `OPEN_QUESTIONS.md` ainda mantém hosting/deploy definitivo em aberto.

## Decision

Adotar **GitHub Actions** como control plane oficial de CI/CD.

O pipeline define contratos de LOCAL, PREVIEW, STAGING e PRODUCTION independentemente do provider de hosting.

Para deployment remoto, manter um **adapter Vercel reversível**, porque Vercel já é uma direção técnica compatível com Next.js, sem transformar essa escolha em dependência de domínio.

Supabase permanece o adapter de dados já adotado pela arquitetura; staging e production devem usar projetos separados.

## Consequences

Positivas:

- CI/release gates independem da UI/produto;
- migrations são validadas antes do deploy;
- environments e secrets ficam separados;
- provider de hosting pode ser trocado sem alterar domain/application;
- produção é manual/gated, não consequência automática de um push.

Custos:

- staging/production remotos exigem provisionamento separado;
- GitHub Environments/branch protection dependem de configuração administrativa;
- token de deploy do provider precisa de rotação e mínimo privilégio;
- preview externo fica desabilitado até haver infraestrutura não-prod adequada.

## Alternatives considered

### Deploy automático direto da branch `main`

Rejeitado: não satisfaz review/release gate nem separa staging/production adequadamente.

### Provider-specific pipeline espalhado pelo repositório

Rejeitado: fecharia uma questão ainda aberta e aumentaria custo de troca.

### Somente scripts manuais

Rejeitado: não produz gates verificáveis nem proteção contra regressões.

## Guardrails

- nenhuma feature do usuário depende do adapter Vercel;
- preview nunca recebe production secrets;
- production só libera após `Release Gate` + GitHub Environment;
- migrations históricas são imutáveis;
- provider definitivo continua registrado em `OPEN_QUESTIONS.md` até decisão explícita.
