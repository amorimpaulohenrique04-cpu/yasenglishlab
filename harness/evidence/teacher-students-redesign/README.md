# Alunos do professor — implementação local

Status: implementação local para avaliação; certificação ampla pendente, `verified:false`. Sem commit, push ou publicação. Alterações anteriores do workspace preservadas.

## Entrega

- Listagem com quatro indicadores reais de toda a carteira, busca/filtros/ordenação/página/visualização na URL, oito alunos por página e colunas fixas para acompanhamento/ações.
- Distribuição por curso e feed de cinco eventos; sheet com dez eventos por página e filtro por tipo.
- Perfil com Resumo, Atividades, Avaliações e Notas internas; retorno preserva os filtros. Notas e pedidos usam os comandos canônicos existentes.
- Projeções completas de trilha, sem média de amostra ou limite do contexto legado. Atenção aos sete dias somente com matrícula ativa; pedido aberto é sinal independente.
- Migration aditiva `20261023211118_teacher_students_workspace.sql` aplicada somente no banco local. Nenhuma tabela de negócio nova, nenhuma ampliação de RLS, nenhum dado de teste permanente.

## Checks executados

| Check                                                                              | Resultado                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | PASS após corrigir quatro props de altura dos Skeletons para strings.            |
| ESLint direto nos arquivos TS/TSX da tarefa                                        | PASS; revisão final dos três componentes também PASS.                            |
| `node node_modules/vitest/vitest.mjs run tests/unit/student-workspace.test.ts`     | PASS: 5 testes, 3,78 s. Aviso pré-existente do config loader do Vite, sem falha. |
| `node harness/evidence/teacher-students-redesign/local-db.mjs --check`             | PASS: migration compilada em transação revertida.                                |
| `node harness/evidence/teacher-students-redesign/local-db.mjs --apply --smoke`     | PASS: apenas a migration da tarefa aplicada; fixtures revertidas.                |
| `node harness/evidence/teacher-students-redesign/local-db.mjs --smoke`             | PASS com a regressão histórica acrescentada; fixtures revertidas.                |

O SQL permanente em `supabase/tests/teacher_students_workspace.sql` cobre 205 alunos (além do limite antigo), paginação, vínculos expirados, múltiplas matrículas sem duplicar distribuição, trilha CUSTOM, denominador completo (50% na fórmula antiga versus 25% correto), sete dias exatos/um segundo antes, tolerância de vínculo novo, conclusão/Entrada sem alerta temporal, filtro de turma, notas próprias, pedido idempotente, ausência de atividade de aprendizagem gerada pelo professor, AAL1 e outro professor.

## Conferência manual no Chrome

- Carteira local com 14 alunos: 5 revisões (3 práticas + 2 de entrada), média de 31% entre 7 matrículas ativas com trilha. Indicadores mantidos ao buscar e paginar.
- Busca por Beatriz, abertura do perfil e retorno preservando `q=Beatriz`; quatro abas do perfil carregadas.
- Paginação de 1–8 para 9–14 e volta à primeira página.
- Filtro de matrícula ativa em sheet móvel: 7 alunos e estado refletido na URL.
- Feed: 56 eventos globais, filtro Práticas com 19 eventos, dez por página.
- Nota: rascunho preservado ao cancelar/reabrir; submissão de três espaços rejeitada pelo servidor, formulário e três caracteres preservados. Nenhuma nota ou pedido válidos foram gravados pela UI; o caminho de sucesso de ambos foi exercitado no smoke SQL revertido.
- Desktop: tabela e lateral; tablet de 1024×768 recomposto em cartões de duas colunas para evitar tabela comprimida; celular de 390×844 com uma coluna, abas/contagens e filtros/formulários em sheets.
- Sem overflow horizontal: desktop scrollWidth 1536 / innerWidth 1536; tablet 1009 / 1024; celular 375 / 390. Colunas de acompanhamento e ação com o mesmo X nas oito linhas (931,94 e 1080,85; ação com 105,15 px), antes do último ajuste de cabeçalho.
- Console consultado: um erro de extensão Chrome em `chrome-extension://…/share-modal.js`, fora da origem da aplicação; nenhum erro da aplicação retornado na consulta focada.

## Capturas inspecionadas

- `reference.png`: referência aprovada.
- `desktop.jpg`: composição de desktop.
- `tablet.jpg`: cartões em duas colunas.
- `mobile-list.jpg`: lista móvel (antes do pequeno ajuste que mantém as contagens visíveis abaixo dos rótulos das abas).
- `profile-desktop.jpg`, `profile-mobile.jpg`: resumo pedagógico.
- `filters-mobile.jpg`, `request-mobile.jpg`: sheets móveis.
- `activity-feed.jpg`: feed filtrado.

O navegador devolveu JPEG; os arquivos usam a extensão correspondente, sem edição dos pixels. Houve timeout intermitente na captura de página inteira; foram usadas capturas de viewport. Overrides temporários de viewport foram restaurados. Algumas capturas precedem ajustes locais de rótulo/contexto de turma, sem alteração de estrutura.

## Limites desta validação

Gates oficiais, build, suítes amplas, execução em banco remoto e certificação de regressão estão adiados por pedido explícito do usuário. Os testes pequenos não representam certificação completa. Histórico de aula é o último registro persistido por aula, não uma trilha de todos os acessos. Não há criação de aluno, e-mail, ações em lote, inferência CEFR ou regra nova de matrícula/reserva.

No ambiente, `npm` apontava para uma instalação global ausente. O dev server foi iniciado com `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1`, sem instalar dependências nem alterar configuração global.
