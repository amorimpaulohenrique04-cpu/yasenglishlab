# Evidência — teacher-practice-header (2026-10-23)

Mudança intencional solicitada pelo usuário: breadcrumb acima, título/badge agrupados, status abaixo, prévia ghost, salvar outline e revisão violeta. Nenhum handler de salvamento/publicação foi alterado.

## Inspeção no Chrome autenticado

- Desktop 1536 px: agrupamentos separados e ações alinhadas à direita (`desktop.png`, `header-after.png`).
- Tablet 834 px: ações em linha abaixo da identidade (`tablet.png`); scrollWidth 834.
- Celular 390 px: ações empilhadas, textos e ícone preservados (`mobile.png`); scrollWidth 375 <= innerWidth 390; cada botão do cabeçalho tem 44 px de altura.
- Celular 320 px: scrollWidth 320; nenhum elemento do main ultrapassa a viewport (`mobile-320.png`).
- Prévia abriu com "Prévia do professor: nada é salvo"; Fechar retornou ao editor.
- Viewport restaurada ao tamanho original. Não houve edição de conteúdo, salvamento manual ou publicação.

## Checks

- ESLint em practice-builder.tsx: exit 0.
- Prettier em practice-builder.tsx e practices.module.css: exit 0.
- git diff --check: exit 0 (avisos CRLF em estado preexistente).
- Typecheck isolado: exit 1; erros sintáticos no arquivo gerado `.next/dev/types/routes.d.ts`, linhas 148–156 (`typecheck.log`). Nenhum arquivo gerado foi modificado nesta tarefa.
- verify:agent inicial: exit 1 na formatação de quatro arquivos de estado harness; conteúdo preservado e formatação corrigida dentro do escopo, repetição em `verify-agent-retry.log`.
- verify:ui: exit 1; exige CANONICAL_E2E=1. Não foi fornecida configuração de stack canônica isolada; sem preparar fixture no banco dev. Ver `verify-ui.log`.

Verificação completa pendente. Registry in_progress/verified:false.

## Resultado final da repetição de verify:agent

Formatação: passou (908 arquivos rastreados). Lint global: passou com 0 erros e 1 warning preexistente em `.stage12-df.config.ts`. O gate parou no typecheck pelos mesmos erros em `.next/dev/types/routes.d.ts` (148–156). Log: `verify-agent-retry.log`. Unit/integration/build e demais etapas não foram alcançados. Verificação completa continua pendente.
