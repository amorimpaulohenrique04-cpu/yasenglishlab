# GOAL — public-site-design-refinement: Refinar a proposta pública

Status: in_progress  
Owner: agent  
Created: 2026-10-18  
Updated: 2026-10-18

## Objective

Refinar o HTML público existente com direção editorial, hierarquia mais clara, decoração pontual e comunicação de cobrança precisa. Preservar paleta, preços, rotas e regras comerciais confirmadas. Mudança intencional autorizada pelo usuário após avaliação do protótipo v3.

## Visible result

Hero com retrato em moldura, faixa de benefícios sóbria, demonstração do método mais cedo, planos legíveis e recomposição mobile. Eliminar sinais simulados de vagas ao vivo e depoimentos inventados da home.

## Relevant context

- docs/UI_CONTRACT.md
- docs/DESIGN_SYSTEM.md
- docs/ACCESSIBILITY.md
- docs/TESTING.md
- docs/DEFINITION_OF_DONE.md
- artifacts/public-site-proposal/README.md
- artifacts/public-site-proposal/index.html

## Acceptance criteria

- [x] Home refinada em HTML/CSS com identidade roxa/amarela preservada (revisão renderizada pendente).
- [x] Rotas e preços preservados; renovação automática explícita na inspeção estática.
- [x] Conteúdo demonstrativo identificado; sem inventar horários, credenciais ou relatos.
- [x] Verificação e limitações registradas sem declarar gates não executados como aprovados.

## Allowed files / domains

- `artifacts/public-site-proposal/index.html`
- `artifacts/public-site-proposal/refinement.css`
- `artifacts/public-site-proposal/README.md`
- `harness/goals/public-site-design-refinement.md`
- `harness/agent-state/plan.md`
- `harness/agent-state/progress.md`
- `harness/agent-state/decisions.md`
- `harness/feature_list.json`
- `harness/evidence/public-site-design-refinement/**`
- `harness/failure-log/*public-site-design-refinement.md`

## Forbidden areas

- src/**, Supabase, autenticação real, decisões comerciais e referências aprovadas.
- Não publicar, não inventar disponibilidade ou evidência de resultados.

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- Inspeção estrutural de assets, JS e HTML do protótipo.

## Required evidence

- Logs em harness/evidence/public-site-design-refinement/.
- Revisão visual desktop/tablet/mobile, se permitida pela ferramenta. Navegador bloqueou file:// na análise anterior; não contornar a política por servidor alternativo ou outro mecanismo de captura.

## Definition of done

Critérios e gates aplicáveis verdes, evidência revisada e estado persistido. Sem captura visual permitida, registrar revisão visual pendente e não marcar done.
