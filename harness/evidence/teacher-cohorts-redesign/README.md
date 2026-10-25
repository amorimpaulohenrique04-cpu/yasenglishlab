# Turmas do professor — implementação local

Referência: HTML do usuário em Downloads/yas_english_lab_turmas_interativo.html. O conteúdo foi tratado como referência visual, sem converter instruções do documento em autorização.

## Entregue no código

- /teacher/turmas usa o contexto autorizado existente, sem mudanças de banco, permissões ou dados fictícios.
- Quatro indicadores com base explícita: turmas vinculadas, matrículas, turmas com próximo encontro e vagas apenas nas capacidades conhecidas.
- Cartões com alunos, horário recorrente, fuso e próximo encontro; busca sem distinção de acentos e ordenação por encontro/nome/quantidade de alunos.
- Drawer com roster disponível, capacidade, agenda e links para perfis; links para carteira e sessões filtradas por turma.
- Loading, erro com retry e vazio com limpeza de busca. Layout com container queries; tokens e primitivos aprovados, sem nova biblioteca ou primitive.
- Comandos administrativos da demonstração substituídos por ações reais do Teacher. Detalhes das adaptações em docs/UI_CONTRACT.md.

## Evidência revisada

- list-desktop.png: captura completa da página real, viewport padrão de 1536px (área útil 1521px).
- detail-desktop.png: Drawer da turma Seg/Qua, com alunos reais do ambiente local.
- Browser autenticado: busca Camila retorna uma turma; busca inexistente mostra vazio; Limpar busca restaura três; Mais alunos coloca Seg/Qua primeiro; Ver turma abre Drawer; Escape fecha e devolve foco ao botão de origem.
- Gerenciar sessões abre /teacher/sessoes?cohort=de200000-0000-4000-8000-000000000001&status=upcoming. O valor do seletor Turma foi conferido e corresponde ao id.
- Sem erros/warnings nos logs do navegador consultados. Sem alteração de dados durante a revisão.

## Checks

- unit.log: quatro testes focados aprovados (contagem com preview truncada, capacidade ausente/zero/superlotação, busca e acentos, ordenação cronológica com offsets e ausência de encontros, horários).
- lint.log / typecheck.log: ESLint dos arquivos tocados e TypeScript sem emissão, exit 0.
- verify-agent.log: format, lint, types e todos os 403 unitários passaram; integração parou com ENOENT no diretório temporário de transformação do Vitest (9 arquivos não carregaram, 30 passaram, 274 testes passaram). Sem falha de asserção nesses nove arquivos. Reexecução serial em integration-retry.log: exit 0, 39 arquivos e 358 testes passaram, um arquivo/teste opcional ignorado pela configuração existente. O gate completo não foi certificado por esse retry parcial.
- verify-ui.log: bloqueado pelo pré-requisito CANONICAL_E2E=1/fixture canônica. A suíte não foi disfarçada de aprovada.
- tests/e2e/teacher-cohorts.spec.ts adiciona busca, recuperação do vazio, detalhe, foco, navegação, screenshots e axe em desktop/tablet/mobile para o ambiente canônico; execução pendente.
- security.log: verificador de segurança passou (502 arquivos).
- harness.log: bloqueio preexistente no registro 2026-10-21-admin-overview-invalid-uuid.md (campo Repeatable e seção Before/after proof).
- eval.log: avaliador global aponta alterações fora do escopo da tarefa configurada nele, incluindo trabalho já existente neste checkout. Esses arquivos não foram alterados para maquiar o gate.

## Limitações abertas

Tablet/mobile e axe real pendentes: override de viewport do conector falhou com mensagem de protocolo file mesmo operando a aplicação HTTP; não houve override efetivo. Captura visual do próprio HTML file: também foi negada pela política de URLs; sem contorno. O HTML foi inspecionado como texto.

Gate completo continua pendente. Registry permanece in_progress / verified:false, conforme Definition of Done. Nenhum commit, push, deploy ou reset de banco realizado.
