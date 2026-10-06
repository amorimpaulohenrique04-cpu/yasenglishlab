# GOAL — stage-03d-billing-ui: Billing UI

Status: in_progress

Owner: agent

Created: 2026-10-06

Updated: 2026-10-06

## Objective

Implementar leitura de Billing no Admin e própria assinatura no Profile Student.

## Visible result

/admin/billing com contagens, filtros, paginação e lista mobile; /profile com assinatura apenas Student.

## Relevant context

Base main@7b802abd744fcd138a3ebadfdc043cddf34722f5; branch feat/stage-03d-billing-ui. Contratos BILLING, UI, DESIGN_SYSTEM, ACCESSIBILITY e AUTH_RBAC_RLS.

## Acceptance criteria

- [ ] Admin+AAL2, RLS, paginação de 25 e DTO sem campos de provider.
- [ ] Student somente própria assinatura, snapshot histórico e benefícios existentes.
- [ ] Responsivo, acessível, read-only e Official CI verde.

## Allowed files / domains

Read models Billing, Admin Billing, Profile, AdminShell, CSS local, testes focados e Harness. Extração mínima do helper de benefícios em commercial/plans.ts para reutilizar a fonte existente. Snapshot server-only necessário: authenticated não possui SELECT no vínculo/sessão checkout; consulta restrita aos registros já autorizados por RLS.

## Forbidden areas

Billing Core/provider/webhook/checkout, migrations, globals.css e 3E.

## Mandatory tests

Prettier/ESLint tocados, typecheck focado, unit/integration focados, até dois E2Es com a11y e cinco screenshots, git diff --check. Official CI único gate amplo.

## Required evidence

harness/evidence/stage-03d-billing-ui/: base, rotas, read models, autorização, checks, screenshots e CI.

## Definition of done

Critérios comprovados, registry done/verified:true após CI verde, PR mergeada e main limpa. Parar antes de 3E.
