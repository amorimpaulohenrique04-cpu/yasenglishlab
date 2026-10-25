# GOAL — admin-teacher-redesign: Onda da sidebar + redesign das abas Admin/Professor

Status: in_progress  
Owner: agent  
Created: 2026-10-21  
Updated: 2026-10-21

## Objective

Mudança só de design. Corrigir a onda decorativa da sidebar, que deixava a borda reta inferior à mostra acima do card do rodapé depois da compactação por altura (9425fb7). Redesenhar as abas Admin/Professor que foram criadas depois da proposta aprovada (36c9fa7) ou que não seguem a proposta, para que fiquem intuitivas, hierarquizadas e consistentes com ela. Nenhuma regra de negócio, ação, loader, schema ou permissão muda.

## Visible result

- A onda da sidebar fica ancorada ao fundo e passa por trás do card do rodapé em qualquer altura de tela.
- Ocorrências, Suporte, Planos e direitos, Teste de entrada, Aluno (admin), Conteúdo/Trilha, Disponibilidade, Revisões, Alunos, Sessões e Práticas usam padrões claros: fila/inbox, editor com painel lateral, revisão dividida, perfil com abas e seções de formulário.

## Relevant context

- Plano aprovado: `C:\Users\PAULO HENRIQUE\.claude\plans\s-mudan-as-no-design-hazy-emerson.md`
- Mockups: `artifacts/design-proposal/screens/adm_*`, `prof_*`
- Referências Mobbin salvas em 2026-10-14: `artifacts/design-references/references.json`. Hoje o Mobbin MCP exige plano pago, então não houve busca nova.
- `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`

## Acceptance criteria

- [ ] A borda inferior da onda não aparece em 1440×768/800/900 (aluno, professor, admin).
- [ ] As telas redesenhadas preservam `name` dos campos, `action` dos formulários e os nomes acessíveis usados por `tests/e2e`.
- [ ] As telas não têm scroll horizontal em 375px.
- [ ] Os e2e das áreas tocadas passam.
- [ ] Os goldens visuais só são promovidos com aprovação do dono.

## Allowed files / domains

- `src/components/layout/**` (sidebar, CSS de layout)
- `src/app/(protected)/(admin)/admin/**/page.tsx` e componentes de UI locais
- `src/app/(protected)/(teacher)/teacher/**/page.tsx` e componentes de UI locais
- `src/modules/*/ui/**` (somente markup/CSS)
- `artifacts/redesign-shots/**`, `harness/**` (evidência/estado)

## Forbidden areas

- `actions.ts`, `src/server/**`, `supabase/**`, domínio/regras, auth/RLS
- Textos de e2e e goldens atualizados às cegas

## Mandatory tests

- `npm run typecheck`, `npm run lint`
- e2e das áreas tocadas
- `npm run verify:ui`
- `npm run verify:agent`

## Required evidence

- Screenshots antes/depois em `harness/evidence/admin-teacher-redesign/`

## Definition of done

Ver o template: critérios atendidos, checks verdes e evidência inspecionada.
