# ADR 0020 — Autoria de prática pelo professor e atribuição por turma

## Status

accepted

## Date

2026-10-15

## Context

Até a Etapa 11 só o Admin criava conteúdo (ADR 0006: Teacher e Support sem grant editorial). Toda prática publicada ficava visível a todo aluno matriculado no curso, sem autor, sem escopo e sem atribuição. O formato aceitava apenas múltipla escolha e texto/áudio com revisão manual. O professor não tinha como configurar as práticas que o aluno executa.

## Decision

1. **Autoria no próprio escopo.** O professor (TEACHER + AAL2) cria, edita, publica, despublica, duplica e atribui práticas. O curso da prática precisa ser de uma turma **ativa** dele (`private.is_teacher_for_course`, derivado de `cohort_teachers`); as turmas atribuídas precisam ser dele e do mesmo curso. Todo acesso passa por RPC `security definer`, com lock, auditoria e `revoke` explícito de `public`, `anon` e `authenticated` antes do `grant`.
2. **Atribuição só por turma.** `cohort_practice_assignments(cohort_id, practice_activity_id, due_at opcional)`. Prática de professor nasce com `audience = 'ASSIGNED'` e só é visível a aluno com membership ativa em turma atribuída. Rascunho nunca é visível ao aluno. Práticas do Admin continuam `COURSE`.
3. **Formato `content` v2.** `stimulus` (NONE, TEXT, IMAGE, AUDIO, VIDEO) combina com qualquer `response` (CHOICE_SINGLE, CHOICE_MULTI, TRUE_FALSE, CLOZE, ORDERING, WRITTEN, SPOKEN). Os formatos legados continuam válidos. O gabarito fica em `private.practice_answer_keys` e nunca é devolvido ao aluno.
4. **Correção.** Os cinco tipos objetivos são corrigidos no banco (`DETERMINISTIC`). WRITTEN e SPOKEN entram na fila de revisão existente (`MANUAL_PENDING`), sem nota agregada e sem CEFR (ADR 0010). A habilidade `WRITING` passa a existir; `LISTENING` passa a ser aceita.
5. **Imutabilidade.** Prática com tentativas não pode ser editada; o professor duplica. O Admin pode despublicar qualquer prática.
6. **Mídia.** Imagem, áudio e vídeo do estímulo ficam em `practice_activity_assets`, lidos por URL assinada curta depois de `can_view_practice_activity`. Vídeo usa armazenamento protegido com URL assinada, sem transcodificação; a generalização do pipeline de vídeo das aulas fica como evolução.
7. **Acessibilidade.** Imagem exige texto alternativo; áudio e vídeo recebem aviso de transcrição ausente; ordenar tem alternativa por botões, sem depender de arrastar.

## Alternatives

- Reaproveitar `admin_content_*` para o professor: rejeitado, ampliaria o grant editorial do ADR 0006 para todo o conteúdo.
- Atribuição por aluno: rejeitada pelo product owner; só turmas.
- Aprovação do Admin antes de publicar: rejeitada pelo product owner; o professor publica direto no próprio escopo.

## Consequences

- ADR 0006 segue valendo para cursos, módulos, aulas, materiais e avaliações.
- Notificação é apenas in-app; e-mail fica fora de escopo.
- A rubrica de revisão passa a cobrir WRITTEN.
