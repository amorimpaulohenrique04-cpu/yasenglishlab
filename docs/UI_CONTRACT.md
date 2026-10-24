# UI Contract

## Propósito

Impedir que o Yas perca consistência visual conforme novas páginas, pessoas ou coding agents alterem o produto.

## Decisões

- As imagens em [reference-ui](./reference-ui/README.md) são **fonte de verdade visual**.
- Se texto e screenshot divergirem apenas em estética, prevalece o screenshot aprovado.
- Roxo = identidade, navegação e estado principal.
- Amarelo = ação prioritária/destaque controlado.
- Superfícies principais = branco sobre fundo claro/lilás.
- Cards arredondados, baixa densidade, hierarquia tipográfica forte.
- Ícones lineares/coerentes.
- Elementos manuscritos/decorativos são assinatura pontual.
- Mobile é recomposição, não desktop espremido.

## Invariantes

- Sidebar, headers, spacing, radius, tipografia e CTA não mudam por página sem razão explícita.
- Reutilizar componentes antes de criar novos.
- Loading, empty, error, disabled, success e focus fazem parte do contrato.
- Acessibilidade é requisito do componente.
- Alteração visual relevante declara a diferença e produz evidência.

## O que não fazer

- Nova paleta por feature.
- Novo padrão de card sem diferença semântica.
- Valores arbitrários se há token equivalente.
- Esconder informação essencial apenas para “limpar” layout.
- Usar cor como único indicador de estado.
- Redesenhar referências por conveniência de implementação.

## Interfaces

[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [ACCESSIBILITY.md](./ACCESSIBILITY.md) · [TESTING.md](./TESTING.md) · [reference-ui/README.md](./reference-ui/README.md)

## Critérios de aceitação

- Mudança visual reutiliza design system.
- Desktop/tablet/mobile revisados.
- Evidência visual existe quando necessário.
- Referência aprovada não sofre regressão não declarada.

## Etapa 11 — estados de acesso

- `/progresso` mostra o aviso de suspensão (`SubscriptionSuspendedNotice`) quando aplicável e mantém os dados visíveis: suspensão não altera progresso (ADR 0016, decisão 2).
- Matrícula `COMPLETED`: Home e Progresso mostram "Curso concluído" no lugar da próxima aula.
- `/support`: página protegida, somente com orientação textual. Sem e-mail, telefone, WhatsApp ou URL até a decisão do canal (OPEN_QUESTIONS). Avisos de suspensão e `/billing/return` apontam para ela.
- `/pratica` sem matrícula: estado vazio explicativo, sem atividades.

## Proposta visual aprovada (2026-10-16)

- Linguagem visual de aluno, professor e admin segue `artifacts/design-proposal/{aluno,professor,admin}.html` (goal `ui-redesign-approved-proposal`).
- Shell único (`RoleShell`): sidebar roxa sólida com logo e onda, grupos no staff, topbar com perfil e selo de sessão verificada (aal2), drawer no celular e tab bar inferior para o aluno.
- Perfil e Suporte usam o shell do papel principal do usuário (grupo de rotas `(account)`).
- Blocos do protótipo sem fonte de dados não aparecem (ver `harness/agent-state/decisions.md`).
- Logo, frase manuscrita e fotos em `public/brand/` são placeholders recortados das referências; trocar pelos arquivos oficiais.

## Sessões do professor — referências do usuário (2026-10-21)

As seis imagens aprovadas no plano do chat orientam agenda, assistente, detalhes, drawers e relatórios. Preservar o shell e os tokens existentes. Adaptações intencionais: Conversation Lab permanece disponível; Workshop não pode ser criado/editado pelo assistente; turma obrigatória em grupo; Recife explícito; presença desde o início; sala Meet manual; abas sem anotações/checklist fictícios; relatórios sem inferir conclusão pelo relógio. Mobile usa lista diária e conteúdo empilhado. Evidência em `harness/evidence/teacher-sessions-redesign/`.

### Polimento visual (2026-10-22)

Decisões do usuário: visual + UX sem regra nova; **CTA primário violeta** (variante `secondary`) em toda a área de Sessões, ficando o amarelo para destaques pontuais; animações com `motion` (ver DESIGN_SYSTEM).

| Função | Superfície |
| --- | --- |
| Agenda, Semana e Mês | Página, com filtros aplicados na hora e refletidos na URL |
| Criar | Página com assistente de 3 etapas |
| Editar, link do Meet, disponibilidade e recursos | Sheets |
| Cancelar | Dialog |
| Busca | Ctrl/⌘ K |
| Relatórios | Página analítica |

- **Semana:** grade de horários real. A disponibilidade é clicável e cria uma sessão já preenchida no horário clicado.
- **Mês:** até 3 chips por dia.
- **Celular:** a Semana vira uma faixa de dias com a lista do dia escolhido; o Mês mostra pontos.
- **Relatórios:** área e donut desenhados em SVG com tokens, sempre com uma tabela alternativa. Os destaques são fatos derivados do relatório e só aparecem quando há base de comparação.

## Entrada do professor — 2026-10-23

Referência: imagem anexada pelo usuário no chat teacher-entry-redesign. Composição de fila com quatro indicadores e cartões horizontais; detalhe com faixa do aluno, abas Respostas e análise/Resumo/Histórico, accordions por habilidade e formulário lateral. CTA violeta, tokens e motion iguais a Revisões; no celular o formulário segue as evidências.

Diferenças intencionais: SLA de 24h, sem confiança por questão não coletada, sem turma inferida, feedback limitado a 4.000 caracteres, notas pessoais e IA explicitamente não configurada. Finalização não promete notificação externa. Validação ampla adiada por pedido do usuário; capturas em harness/evidence/teacher-entry-redesign/.

## Disponibilidade do professor — referência do chat (2026-10-23)

A referência está em harness/evidence/teacher-availability-redesign/reference.png. Composição: KPIs superiores, grade semanal domingo–sábado à esquerda, formulário/presets e lista alinhada à direita. CTA violeta, container queries e motion/primitives existentes em Revisões. No celular: faixa de dias, agenda diária e criação em sheet. Datas/horários com DateField e TimeField.

Diferenças intencionais aprovadas: fuso fixo America/Recife; disponibilidade configurada não promete publicação direta para alunos; recorrência com data final; cartão Como funciona no lugar de regras de reserva fictícias. Horários ativos/pausados e sessões agendadas têm identificação textual, sem depender só da cor. Criação em lote e alterações de série têm resumo de impacto; horários avulsos usam switch direto com reversão ao rejeitar. Sem gates completos na entrega inicial, por solicitação explícita.

## Alunos do professor — referência do chat (2026-10-23)

Referência em harness/evidence/teacher-students-redesign/reference.png. Listagem com quatro indicadores, tabela alinhada e lateral com distribuição/feed. Perfil com Resumo, Atividades, Avaliações e Notas internas. Mesmo shell, tokens, CSS Modules, container queries e motion de Revisões. Mobile recompõe tabela em cartões e filtros/formulários em sheets.

Adaptações aprovadas: distribuição por curso, sem e-mails, sem percentuais de crescimento inventados, sem cadastro/seleção em lote; revisões substituem o CTA administrativo. Progresso usa a trilha completa e não representa CEFR. Inatividade só com matrícula ativa, após sete dias, respeitando o início do vínculo. Contrato em docs/TEACHER_STUDENTS.md. Validação ampla adiada pelo usuário; verified:false.
