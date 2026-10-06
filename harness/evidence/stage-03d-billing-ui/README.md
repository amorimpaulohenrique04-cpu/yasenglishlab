# 3D — Billing UI evidence

Base: main@7b802abd744fcd138a3ebadfdc043cddf34722f5.

Branch: feat/stage-03d-billing-ui.

## Rotas e read models

/admin/billing: loadAdminBilling, três contagens reais, filtros status/plano, página de 25, DataTable.mobile e DetailDrawer somente leitura.

/profile: loadOwnSubscription somente para STUDENT; estados humanos, snapshot histórico, benefícios compartilhados, datas persistidas e cancelamento agendado.

## Autorização

Admin requirePageRole("ADMIN") preserva AAL2. Assinaturas, contagens, Profiles, Plans e benefícios usam cliente authenticated/RLS. Student deriva userId de assertRole("STUDENT") e aplica filtro explícito de ownership.

Snapshot server-only é necessário porque authenticated não possui SELECT no vínculo billing_checkout_session_id nem na tabela billing_checkout_sessions. A consulta privilegiada recebe apenas registros já autorizados por RLS, é bounded e verifica id, owner e Plan nos dois lados. DTO não inclui IDs internos/provider/payload/errors. Nenhuma policy, grant, migration, provider call ou mutation financeira foi adicionada.

Extração mínima de planBenefits em commercial/plans.ts preserva a fonte e as regras existentes, sem duplicar labels de entitlement nem mudar checkout.

## Checks locais

- Prettier somente arquivos tocados.
- ESLint somente TS/TSX tocados.
- TypeScript: tsconfig.billing-ui.json.
- Unit/integration: 11 testes focados passaram.
- E2E Student passou com RLS real negando outro Student, snapshot diferente do preço atual, ausência de IDs/provider, keyboard, a11y e responsive 1440/390.
- E2E Admin: primeira execução detectou overflow; correção CSS local seguida de apenas um rerun Admin, passou em 15,1 s.
- git diff --check passou.

## Screenshots

Cinco imagens revisadas visualmente: admin-desktop.png (1440), admin-tablet.png (1024), admin-mobile.png (390), student-desktop.png (1440), student-mobile.png (390).

## Official CI

Pendente. Único gate amplo. Nenhuma suíte local ampla executada.

CI inicial 37534534349: TypeScript rejeitou apenas o adapter de teste novo (TS2339). Corrigido sem mudança de UI/read models; typecheck focado exit 0, ESLint do teste exit 0 e oito integration tests passaram. E2Es não repetidos porque a correção afetou somente o mock.

[PR #45](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/45). O commit de fechamento altera somente Harness; seu [CI final](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/45/checks) deve concluir verde antes do merge. 3A–3C preservados; macro in_progress/verified:false; 3E não iniciado.
