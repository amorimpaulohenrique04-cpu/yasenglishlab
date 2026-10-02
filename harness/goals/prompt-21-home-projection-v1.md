# GOAL — prompt-21-home-projection-v1: Home definitiva / Student Home Projection V1

Status: done  
Owner: agent/human  
Created: 2026-10-01  
Updated: 2026-10-01

## Objective

Entregar `/home` como uma projection/read model transversal e read-only de Learning, Practice e Schedule, derivando o resumo curricular dos mesmos fatos de Learning, com uma única ação principal determinística e sem criar nova fonte de verdade, writes, regra comercial, CEFR, streak ou recomendação paralela.

## Visible result

Um Student autenticado abre `/home` e entende rapidamente o que fazer agora. A Home prioriza sessão reservada acontecendo agora, depois aula incompleta, depois a recomendação existente de Practice e por fim booking futuro. Learning, Practice, Agenda e progresso curricular aparecem como resumos verdadeiros, inclusive estados empty/partial/error, em desktop/tablet/mobile conforme a referência visual aprovada.

## Relevant context

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/PERFORMANCE.md`
- `docs/SECURITY.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/LIVE_CLASSES.md`
- `docs/CEFR_ASSESSMENT.md`
- `docs/reference-ui/home/`
- P13 Learning, P15 Practice, P16 Agenda e P20 Progress.

## Acceptance criteria

- [x] `/home` é uma projection transversal e não chama page loaders de outras features.
- [x] Existe no máximo uma `primaryAction`, seguindo exatamente Schedule-now → Learning → Practice → future Schedule.
- [x] Resume de Learning usa o `lastAccessedAt` mais recente entre aulas incompletas; fallback sem progresso usa ordem canônica.
- [x] Múltiplos cursos não usam média global nem `courses[0]` como política implícita.
- [x] Practice reutiliza `recommendPractice`; Agenda usa booking real do Student.
- [x] Progress summary é curricular, curto e derivado dos mesmos fatos de Learning.
- [x] Auth e Supabase client são criados uma vez no boundary Home; reads independentes iniciam concorrentemente.
- [x] Empty, partial e error são distintos; erro de domínio não vira vazio.
- [x] Home não escreve em Learning, Practice, Schedule, Progress ou outro domínio.
- [x] Nenhuma migration, nova RLS, service-role path, plan conditional, CEFR, streak, goal ou analytics novo.
- [x] Desktop/tablet/mobile, a11y, E2E e golden da Home são atualizados sem regressão das demais páginas.
- [x] PR aberta contra `main`, sem merge.

## Allowed files / domains

- `src/app/(protected)/(student)/home/**`
- `src/modules/home/**`
- `src/server/home/**`
- `src/app/globals.css` apenas para importar CSS exclusivo da Home
- extrações mínimas em Learning/Practice/Schedule somente se necessárias para reutilização
- testes focados na Home e ajustes canônicos de E2E/a11y/golden
- fixture canônica somente se necessária
- `harness/**`
- docs somente se comportamento implementado exigir sincronização

## Forbidden areas

- Learning write path, lesson progress RPC, Practice scoring/submit, booking RPC/capacity, attendance, Assessment Engine, CEFR, Admin Content, Teacher Operations, billing, entitlements e publication rules.
- Nova migration/tabela/snapshot/trigger Home sem blocker comprovado.
- Novo recommendation engine, score de prioridade, gamificação, streak, goals, upgrade CTA ou meeting provider.
- Relaxar RLS, usar service role no runtime da Home, adicionar skip/fixme, enfraquecer assertions ou aumentar timeout para esconder regressão.

## Mandatory tests

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:visual:golden`
- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:ui`
- `npm run verify:full`
- `npm run verify:db` somente se houver DB/SQL change.

## Required evidence

- Unit/application evidence do algoritmo, partial/error, concorrência e chamadas bounded.
- E2E Home → domínio responsável, empty/onboarding e browser-visible DTO sem dados internos.
- A11y e golden desktop/tablet/mobile da Home.
- Official CI do head SHA final, jobs/logs inspecionados.
- Diff final sem migration, write path ou arquivo fora de escopo.
- Registros duráveis em `harness/evidence/prompt-21-home-projection-v1/`.

## Definition of done

Done significa todos os critérios aplicáveis e gates obrigatórios observados verdes, evidência visual/CI inspecionada, registry/progress/evidence coerentes com o estado real, open questions preservadas, PR contra `main` aberta e nenhum merge realizado.
