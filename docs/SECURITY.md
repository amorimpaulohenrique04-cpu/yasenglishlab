# Security & Privacy Baseline

## Propósito

Aplicar security by design desde o repositório, alinhando controles ao risco real do SaaS educacional e à LGPD.

O threat model executável desta fase está em [THREAT_MODEL.md](./THREAT_MODEL.md).

## Baseline implementada

- least privilege;
- Supabase Auth com SSR cookies;
- identidade server-side verificada com `getClaims()`;
- roles duráveis em banco;
- RLS + autorização server-side;
- MFA/AAL2 para TEACHER, SUPPORT e ADMIN;
- secrets apenas em runtime seguro;
- service role bloqueada no client por arquitetura + CI;
- validação Zod em Server Actions/serviços;
- password reset com resposta não enumerável;
- storage privado para conteúdo protegido;
- signed URLs emitidas somente após autorização e com TTL entre 30 e 300 segundos;
- booking com lock/capacidade no Postgres;
- billing events idempotentes;
- audit log append-only para operações críticas;
- secret scanning estrutural no CI.


## CI/CD & supply-chain security

O contrato operacional completo está em [CI_CD.md](./CI_CD.md).

Controles obrigatórios:

- GitHub Actions externas pinadas por commit SHA completo;
- `npm ci` + lockfile versionado;
- dependências diretas com versões exatas;
- `npm audit` bloqueando runtime high/critical e qualquer critical no conjunto completo;
- lifecycle scripts de dependências presos a allowlist revisada;
- scanner de secrets em todo o repositório;
- workflows normais com `contents: read`;
- preview, staging e production com GitHub Environments separados;
- production secrets nunca disponíveis a preview;
- production release exige CI verde, review e release gate.

O scanner local/CI é defense-in-depth e não substitui secret scanning/revogação oferecidos pelo provider Git quando disponíveis.

## Protected assets

O bucket `yas-protected-assets` é privado e possui limites de tamanho/MIME no schema. Esta fase não concede policy de upload/download direta a `authenticated`.

Para download:

1. o usuário consulta Material/LessonAsset/Recording usando seu JWT;
2. RLS decide enrollment, booking, assignment e entitlement;
3. somente o path já autorizado chega ao serviço server-only;
4. o admin client emite uma signed URL curta;
5. o audit trail registra apenas tipo/id/TTL — nunca a URL ou storage path.

Para upload futuro, o endpoint deverá validar tamanho, MIME declarado **e conteúdo real/magic bytes** antes de persistir. Até esse serviço existir, upload autenticado direto permanece negado.

## Logging

Senhas, JWTs, refresh tokens, secrets, payload bruto de billing e signed URLs nunca entram em logs de aplicação/audit.

Audit payloads de triggers são allowlisted. O Data API não concede a usuários autenticados acesso à coluna `billing_events.payload`.

## Invariantes

- Autorização crítica não depende do cliente.
- Browser não é autoridade para `user_id`, role ou entitlement.
- Ação privilegiada exige identidade e escopo suficientes.
- Staff privilegiado exige AAL2.
- Secret não é commitado nem exposto no bundle.
- URL assinada é temporária e emitida após RLS/autorização.
- Redirect de checkout não libera benefício.
- Se o produto aceitar crianças, governança específica deve existir antes do lançamento dessa capacidade.

## O que não fazer

- `service_role` no browser.
- `getSession().user` como prova suficiente de autorização server-side.
- role em `user_metadata`.
- liberar assinatura por redirect de checkout.
- colocar signing key de meeting no cliente.
- logar senha/token/secret/dado sensível desnecessário.
- upload irrestrito.
- conceder acesso amplo por conveniência operacional.
- considerar uma policy correta sem teste positivo e negativo.

## Interfaces

[AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [THREAT_MODEL.md](./THREAT_MODEL.md) · [BILLING.md](./BILLING.md) · [OPERATIONS.md](./OPERATIONS.md) · [CI_CD.md](./CI_CD.md) · [TESTING.md](./TESTING.md)
