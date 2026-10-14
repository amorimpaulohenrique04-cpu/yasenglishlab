# ADR 0018 — Automatic course completion

## Status

accepted

## Date

2026-10-13

## Context

`enrollments.status` aceita `COMPLETED` desde o modelo de domínio, mas nenhum caminho gravava esse estado. Um aluno que concluía todas as aulas ficava com a matrícula `ACTIVE` indefinidamente, sem encerramento visível. Os gates de leitura e de progresso aceitavam apenas `ACTIVE`.

## Decision

1. **Conclusão automática.** Quando o registro de progresso conclui uma aula e, com isso, todas as aulas publicadas do curso estão concluídas pelo aluno, o banco grava `enrollments.status = 'COMPLETED'` e `completed_at = now()` na mesma transação. A linha da matrícula é travada antes da contagem, para que conclusões concorrentes produzam um único `COMPLETED`.
2. **Leitura preservada.** `COMPLETED` concede o mesmo acesso de leitura e de registro de progresso que `ACTIVE` (helper `private.has_course_enrollment`). O gate de pagamento (ADR 0017) continua valendo.
3. **Sem reabertura automática.** Aulas publicadas depois da conclusão não reabrem a matrícula. O aluno consegue lê-las e registrá-las normalmente.
4. **Transferência e reativação** continuam como no ADR 0015: o upsert de matrícula volta para `ACTIVE` e limpa `completed_at`.
5. **Progresso não é proficiência.** Concluir o curso não altera nenhum sinal CEFR (PRODUCT.md).

## Alternatives

- Admin marca a conclusão manualmente: rejeitado pelo product owner, porque cria trabalho operacional sem ganho pedagógico.
- Usar só `completed_at` mantendo `ACTIVE`: rejeitado; o estado do domínio ficaria ambíguo para relatórios e para o Admin.

## Consequences

- Os read models que procuram o "curso atual" do aluno aceitam `ACTIVE` ou `COMPLETED`.
- Home e Progresso mostram "Curso concluído".
- Se a reabertura por novo conteúdo for desejada, a questão está em OPEN_QUESTIONS.
