# Disponibilidade — implementação e evidência inicial

Referência do usuário preservada em reference.png. Captura desktop final em desktop.png. Entrega local; sem commit/push, build, verify:* ou suítes amplas, conforme instrução expressa.

## Implementado
- Grade domingo–sábado com URL, seleção por clique/teclado/arrasto (15 min), horários ativos/pausados e sessões identificadas; agenda diária no celular e criação em sheet.
- KPIs reais por semana, tempo livre descontando sessões e próximo trecho livre futuro; fuso fixo Recife.
- Presets, DateField/TimeField, múltiplos dias, data final obrigatória, até um ano e confirmação do lote.
- Recorrência materializada, pausa/reativação, edição/exclusão da ocorrência ou futuras; conjunto atômico com idempotência e bloqueio por dependências.
- Sessões e contexto legado consideram apenas cobertura ativa. Horários ativos mantêm a leitura autenticada legada; pausados são restritos ao autor Teacher+AAL2/Admin+AAL2.
- Primitivos e motion existentes, molas do design system, container queries, estados de loading/empty/error e retorno de falhas sem apagar o formulário.

## Verificado
- Migration 20261023200125 e migration aditiva 20261023202030 aplicadas somente ao localhost configurado, sem reset ou outras migrations.
- Smoke SQL real com rollback: 4 ocorrências, retry sem duplicação, conflito sem gravação parcial, pausa/reativação, edição futura, exclusão, bloqueio por sessão agendada, rejeição de criação de sessão em disponibilidade pausada, projeção de semana, isolamento de workspace/pausados, DML direto negado e AAL1 negado. Passou.
- Vitest somente availability-workspace.test.ts: 5/5 passaram. Caso de campo de hora apagado demonstrado vermelho antes da correção e verde depois.
- TypeScript sem emissão: passou. ESLint focado: resultados finais em progress.md.
- Chrome autenticado: grade e painéis renderizados; próxima semana mostra 6 intervalos existentes e 15h livres; contexto refletido em date=2026-10-30.
- Seleção por teclado de 27/10 às 10:00 preencheu formulário; prévia exibiu 9 ocorrências até 25/12 sem salvar.
- Tentativa de pausar intervalo de 26/10 08–11 foi bloqueada com link para Foundations · Rotina e hábitos; nenhum horário foi alterado.
- Mobile 390x844: agenda recomposta e formulário em sheet revisados. Medida observada: innerWidth=390, scrollWidth=375, sem overflow horizontal.

## Limitações
Certificação completa adiada, verified:false. Não rodar gates nesta entrega. Verificação manual não substitui cobertura E2E/a11y ampla. A prévia no browser não gravou novos horários permanentes; fixtures do smoke foram revertidas. Sem regras novas de duração, buffer, antecedência ou visibilidade direta para alunos. A captura persistida é a de desktop; inspeção mobile e do sheet ocorreu no browser, mas a conexão CDP perdeu-se antes de persistir a imagem mobile. Override temporário de viewport restaurado com sucesso.
