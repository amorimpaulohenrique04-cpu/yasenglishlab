# ADR 0022 — Trilha da turma e fechamento da leitura aberta de títulos

## Status

accepted

## Date

2026-10-15

## Context

O conteúdo é escopado só por curso. Turmas de níveis ou linhas de aprendizado diferentes dentro do mesmo curso recebiam as mesmas aulas, na mesma ordem. Além disso, qualquer aluno logado lia títulos de cursos, módulos e aulas publicados de outros cursos.

## Decision

1. **Padrão ou trilha própria.** Cada turma segue o curso padrão ou uma trilha própria (`cohort_paths.mode`). Em trilha própria o aluno vê exatamente os itens da trilha, na ordem da turma.
2. **Itens exclusivos.** `audience = 'COURSE' | 'COHORTS'` em módulos, aulas, materiais e práticas. Itens `COHORTS` só aparecem para turmas que os incluem; um item pode estar em várias turmas.
3. **Liberação por data e sequência.** `cohort_path_items.available_from` e `cohort_paths.sequential` (a aula N+1 só abre com a N concluída pelo aluno). O aluno vê o item bloqueado com o motivo (`LOCKED_DATE`, `LOCKED_SEQUENCE`).
4. **Aplicação no banco.** Predicados `private.student_path_includes` e `private.student_path_available` entram nos leitores de aula, material e prática, em `record_lesson_progress` e nas policies de `courses`, `modules` e `lessons`. Isso substitui a leitura aberta de títulos. TEACHER e ADMIN não mudam.
5. **Conclusão pela trilha.** A conclusão automática (ADR 0018) conta apenas as aulas da trilha do aluno.
6. **Escrita.** Somente ADMIN + AAL2, por RPC com lock por turma, substituição atômica e auditoria. O item precisa pertencer ao curso da turma.

## Alternatives

- Cursos separados por nível: rejeitado, duplica conteúdo e perde o histórico por curso.
- Liberação só por data: rejeitada; a turma precisa de ordem e sequência.

## Consequences

- Leitores que dependiam da leitura aberta (placement, home, agenda) precisam ser revisados e testados.
- Transferir de turma mantém o progresso por aula e recalcula a conclusão pela trilha nova.
