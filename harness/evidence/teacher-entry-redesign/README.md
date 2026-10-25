# Teacher Entry — implementação e validação inicial

Referência original preservada em reference.png. Capturas desktop/celular nesta pasta. Usuário solicitou explicitamente validação simples, sem gates neste primeiro momento.

## Entregue

Fila paginada com KPIs/busca/filtros na URL; revisão por habilidade, Resumo/Histórico, navegação pela fila; recomendação, notas privadas e rascunho explícito com versão; finalização atômica usando comando canônico; contrato IA sem provedor ativo. Loading/empty/error, motion reduzido e container queries.

## Verificação realizada

- TypeScript: checagem sem emissão inicial passou; resultado final registrado em progress.md.
- ESLint somente arquivos desta tarefa: após ajustes de hooks, passou; resultado final em progress.md.
- Vitest somente tests/unit/entry-workspace.test.ts: 2/2 passaram (1,52s), incluindo regressão de gabarito nulo.
- local-db.mjs --apply: somente migration 20261023192114 aplicada ao localhost configurado; sem reset ou outras migrations.
- local-db.mjs --smoke: passou com rollback. Prova leitura autenticada, evidências, salvar/retomar, notas pessoais, versão obsoleta rejeitada, finalizar, retry idêntico, imutabilidade e bloqueio AAL1.
- Navegador Chrome autenticado: fila e detalhe renderizados; salvo um rascunho em Bruno Oliveira · Demo, recarregado e confirmado feedback/notas preservados. Esse rascunho de demonstração permanece para inspeção, sem finalizar casos reais.
- Busca por Carolina retornou uma revisão e atualizou ?q=Carolina; filtro removido depois.
- Desktop e viewport 390x844 revisados. No detalhe mobile innerWidth=390, scrollWidth=375: sem overflow horizontal. Override restaurado ao fim.

## Limitações explícitas

Sem verify:agent/ui/security/db/full, build ou suítes amplas. Sem avaliação live da IA (sem provedor). Certificação ampla permanece pendente, verified:false. Falha inicial do smoke após salvar rascunho no navegador foi isolamento de fixture: o smoke agora seleciona Demo ainda sem rascunho, sem sobrescrever o trabalho manual. Falha inicial de gabarito nulo corrigida com regressão permanente, registrada em failure-log.

## Ajustes após feedback visual (2026-10-23)

+- Finalização: Dialog compartilhado recupera margin:auto; apresentação confirmation compacta, sucesso verde, texto centralizado e trailingIcon no botão. Nova story e regressão visual/foco escritas para a execução posterior, sem rodar a suíte.
+- Lista: status e CTA possuem tracks consistentes de 8.5rem/10.5rem. Medição real desktop em duas linhas: metadataX=734.3875 nas duas, buttonX=1294 nas duas, buttonWidth=168 nas duas, centro do status ≈1206 nas duas.
+- A captura success-desktop.png registra o modal corrigido. Reabertura pela URL result=success somente com recomendação persistida; nenhum novo caso foi finalizado pelo agente para verificar o modal.
