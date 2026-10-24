# GOAL — teacher-students-redesign: Alunos e perfil pedagógico

Status: in_progress  
Owner: agent  
Created: 2026-10-23  
Updated: 2026-10-23

## Objective

Implementar o plano aprovado no chat para listagem e perfil de Alunos do Teacher: composição da referência, indicadores reais, filtros/retorno na URL, projeções completas e paginadas, atenção após sete dias somente com matrícula ativa, notas e pedidos existentes.

## Visible result

Quatro indicadores, tabela/cartões alinhados, distribuição por curso e feed; perfil com Resumo, Atividades, Avaliações e Notas. CSS Modules, container queries e motion no padrão Revisões. Mobile recomposto, sem overflow.

## Relevant context

- Referência: harness/evidence/teacher-students-redesign/reference.png.
- docs/PRODUCT.md, docs/UI_CONTRACT.md, docs/DESIGN_SYSTEM.md, docs/DATA_MODEL.md, docs/AUTH_RBAC_RLS.md, docs/CEFR_ASSESSMENT.md, docs/PLACEMENT.md.
- Implementações existentes de teacher/alunos, student-projection, Revisões, Entrada e trilha curricular.

## Acceptance criteria

- [x] Listagem/perfil implementados e conferidos em desktop/tablet/mobile na validação inicial.
- [x] Métricas completas sem duplicar alunos/matrículas e sem confundir progresso com CEFR.
- [x] AAL2 + vínculo vigente verificados nas projeções; notas apenas do autor.
- [x] Notas/pedidos preservam comandos canônicos e formulário em falhas.
- [x] Evidências e limitações registradas; trabalhos anteriores preservados.

Certificação oficial continua pendente por decisão do usuário; estes itens descrevem a entrega local e seus checks focados, não os gates amplos.

## Allowed files / domains

- src/app/(protected)/(teacher)/teacher/alunos/**
- src/modules/teacher-operations/{domain,ui}/student* e src/server/teacher-operations/student*
- Migration aditiva de projeções Teacher e seus checks SQL focados.
- tests/unit/student-workspace.test.ts; docs/TEACHER_STUDENTS.md, docs/UI_CONTRACT.md, docs/AUTH_RBAC_RLS.md, docs/README.md.
- Harness goal, state, feature registry, evidence e failure-log desta tarefa.

## Forbidden areas

Aluno, Admin, regras de matrícula/reserva/proficiência, mudanças de escopo RLS, dados pessoais de auth.users, dependências, commit/push/publicação. Preservar alterações locais anteriores.

## Mandatory tests

Por pedido explícito do usuário: NÃO executar gates, build ou suítes amplas nesta entrega. Fazer TypeScript/ESLint focados, unidade das regras e smoke SQL local transacional, autorização e conferência visual desktop/tablet/mobile. Certificação oficial permanece pendente e verified:false.

## Required evidence

Capturas em harness/evidence/teacher-students-redesign; comandos/resultados e limitações no README; regras de inatividade, progresso, paginação e segurança em smoke e testes focados.

## Definition of done

Implementação local avaliável com evidências focadas. Não declarar certificação ampla concluída; registry permanece in_progress e verified:false até checks oficiais autorizados.
