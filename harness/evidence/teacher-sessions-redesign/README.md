# Teacher Sessions redesign

Status: implementação entregue localmente; certificação completa pendente por instrução do usuário. Sem PR ou push.

## Escopo e referências

Agenda/Semana/Mês e filtros compartilháveis, assistente em três etapas, edição, detalhes, participantes/presença, recursos/tarefas, Meet manual, disponibilidade e relatórios CSV/PDF. Base local style/sidebar-fit@afff1d8; alterações anteriores preservadas.

As seis imagens orientam a hierarquia e os fluxos. Diferenças intencionais: shell e botões existentes (incluindo CTA amarelo); entradas nativas de data/hora; Conversation Lab preservado; turma obrigatória em grupo; particular com aluno único; Recife explícito; presença desde o início; Meeting manual; nenhuma nota/checklist/objetivo sem fonte de dados. Disponibilidade usa sete colunas de intervalos/ocupações reais no desktop e lista diária no celular. Relatórios mantêm COMPLETED explícito e duração prevista, sem inferir conclusão pelo relógio. Capturas usam fixtures canônicas, não dados de produção.

## Verificação focada

- Build de produção passou. TypeScript e ESLint focado passaram.
- Domínio/PDF/recursos/operações: quatro arquivos / 15 testes passaram na rodada final (6,09 segundos). Configuração/isolamento: três testes passaram separadamente.
- Uma rodada anterior conjunta, concorrendo com o navegador, teve timeout de 20 segundos ao carregar ESLint; o mesmo cenário passou isoladamente no mesmo limite. Sem ampliar timeout nem configurar retries.
- Seis cenários de navegador passaram em produção: criação/disponibilidade, reservas/cancelamento/acesso do aluno, isolamento entre papéis e professores, persistência da presença, filtros/calendários, recursos e downloads.
- Após ajustes visuais, os três cenários específicos do redesign passaram novamente (2,6 minutos). Logs resumidos em browser-focused.log.
- 22 capturas em screenshots/: Agenda/Semana/Mês, criação, detalhes e relatórios em desktop/tablet/mobile; Meet desktop e disponibilidade desktop/mobile. Axe WCAG A/AA, ausência de overflow do documento, Escape/retorno de foco e largura dos drawers verificados.
- SQL focado teacher_operations.sql e teacher_session_workspace.sql passou: isolamento, AAL2, projeção completa com 105 sessões e ausência de referências protegidas. Banco descartável yassessions, portas 573xx.
- verify:security passou (426 arquivos); verify:db passou (64 migrations / 50 invariantes SQL).
- PDF de cinco páginas A4 com acentos e títulos longos gerado e renderizado com Poppler. Primeira/última páginas inspecionadas: sem cortes, paginação e texto legíveis. Downloads reais CSV/PDF verificados com autenticação e resposta privada sem cache.
- As capturas finais precedem apenas o recorte correto dos horários que atravessam meia-noite. Esse limite está coberto pelo teste intervalOnLocalDay; nenhuma estrutura visual mudou após as capturas.

## Gates completos não certificados

Antes da instrução posterior do usuário, tentativas de verify:full pararam em formatação histórica e lint de um checkout aninhado preexistente. Correções restritas e proteção permanente estão nos failure logs. verify:agent também falhou naquele lint; o lint corrigido passou, mas o gate completo não foi reexecutado. verify:ui e verify:full não têm resultado verde.

Em 2026-10-22 o usuário pediu explicitamente não rodar os gates completos. Não são declarados aprovados; a feature permanece in_progress / verified:false para certificação. Logs brutos/configuração local ficam em artefatos temporários, sem versionar credenciais.

## Localhost solicitado

- Banco de desenvolvimento yasenglishlab: API 55321 / PostgreSQL 55322, preservado sem reset.
- Aplicada a migration pendente 20261022023701_teacher_sessions_redesign.sql via supabase migration up --local.
- Executado node scripts/dev-seed.mjs: logins de aluno/professor/admin OK. Uma presença fictícia não criada por booking quota exceeded; regra preservada.
- Next.js iniciado na porta 3000 (PID 21560). http://localhost:3000/login respondeu HTTP 200 com o formulário de login.

## Fase 2 — polimento visual (2026-10-22)

As capturas em `screenshots/` foram regeradas pela spec `teacher-sessions-redesign` com o novo visual. São 22 telas, desktop/tablet/mobile, com axe WCAG A/AA sem violações. Comparação com as seis referências:

- **Agenda:** grupos por dia e card da próxima sessão com contagem regressiva.
- **Semana:** grade de horários; no celular, faixa de dias.
- **Mês:** chips por dia.
- **Assistente:** Stepper, cards de tipo, verificação animada e resumo ao vivo.
- **Detalhes:** cabeçalho com faixa de metadados, abas com contador e coluna de ações.
- **Sheets:** Meet (só Google Meet, link nunca exibido) e Disponibilidade (grade + sugestões).
- **Relatórios:** KPIs com variação, área + donut e ranking de turmas.
- **Fora de propósito** (sem regra/dado): recorrência, Workshop, Zoom/link interno, checklist, anotações e envio automático.
