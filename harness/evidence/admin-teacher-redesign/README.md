# Evidência — admin-teacher-redesign

Data: 2026-10-21. Branch: `style/sidebar-fit`.

## Commits

| SHA | Escopo |
|---|---|
| cc119af | Onda da sidebar presa ao rodapé (não aparece mais a faixa reta); menu do Admin com 12+ itens compacta e cabe em 768px |
| 2e1c401 | Ocorrências e Suporte viraram filas (métricas + painéis por gravidade/estado + drawer); DetailDrawer ganhou triggerText/variant/size/icon |
| f4eee1a | Planos e direitos (card por plano), Conciliação (métricas + fila), Teste de entrada (tabela + editor com painel lateral) |
| aa0442e | Ficha do aluno (cartão de perfil), editor/preview de conteúdo, trilha da turma em outline |
| 64dcd5e | Professor: Disponibilidade (semana + intervalos + drawer), Revisões/Entrada (fila + revisão dividida), Alunos |

## Capturas

- Sidebar: `sidebar/h768/desktop/*.png` e `sidebar/h900/desktop/*.png` (viewport, sem fullPage)
- Antes, professor: `before/{desktop,mobile}/teacher-*.png`
- Depois: `after/{desktop,mobile}/*.png`; `*-open.png` mostra o drawer aberto

## Checks

| Check | Resultado |
|---|---|
| `npx tsc --noEmit -p .` | PASS |
| eslint + prettier nos arquivos tocados | PASS |
| `npx vitest run tests/unit` | PASS: 51 arquivos, 339 testes (rodado após f4eee1a) |
| e2e admin-plans-alerts (edição de direitos), admin-assessments, billing-ui | PASS 4/5. A falha é a overview, por banco local inválido |
| e2e admin-students, admin-content | PASS 2/2 |
| e2e admin-cohorts | FAIL: `/admin/cohorts` cai por UUID não-RFC nas fixtures locais |
| e2e do professor (core-live, placement-enrollment, teacher-operations/pedagogy/practices/surfaces) | FAIL 7/8 no banco local; detalhes abaixo |
| `verify:ui`, `verify:agent`, `verify:full` | NÃO RODADOS |

As falhas do professor vêm do estado do banco local, não das telas redesenhadas:
- Login de alunos de fixture recusado ("Invalid login credentials").
- "Cohort Student A" e "Cohort Basic" ausentes ou ilegíveis.
- Sessões sem encontros, o que mostra o "Criar encontro" do estado vazio duplicado com o do cabeçalho.

O `core-live` passou pela etapa da tela redesenhada (Disponibilidade → `?save=success`). Ver `harness/failure-log/2026-10-21-admin-overview-invalid-uuid.md`. A prova definitiva exige stack limpo: `verify:ui`/`verify:full` ou CI.

## Pendências

- Professor sem redesign nesta rodada: `sessoes/nova`, `sessoes/[sessionId]` (presença), `praticas` (lista + builder).
- Trilha da turma: só passou no typecheck, porque não há turma legível no banco local para capturar.
- Goldens visuais do aluno (home/aulas/progresso) mudam por causa da onda. Promover só com aprovação do dono, a partir do CI.
- Mobbin MCP exige plano pago. Foram usadas as referências salvas em `artifacts/design-references/`.
- Ações no banco local (com autorização do usuário ou dados inseridos por mim e já removidos):
  - fator MFA do professor canônico apagado e recriado pelo helper;
  - chamados e horários de prévia inseridos e depois removidos.
