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

As seis imagens aprovadas no plano do chat orientam agenda, assistente, detalhes, drawers e relatórios. Preservar o shell e os tokens existentes. Adaptações intencionais: Conversation Lab permanece disponível; Workshop é somente leitura; turma obrigatória em grupo; Recife explícito; presença desde o início; sala Meet manual; abas sem anotações/checklist fictícios; relatórios sem inferir conclusão pelo relógio. Mobile usa lista diária e conteúdo empilhado. Evidência em `harness/evidence/teacher-sessions-redesign/`.
