# Product Contract — Yas English Lab

## Propósito
O Yas English Lab é um SaaS educacional/LMS de inglês que combina trilha estruturada, prática recorrente, materiais, acompanhamento de progresso, avaliação de proficiência e encontros ao vivo. A north star de UX é: em menos de 10 segundos, o aluno deve entender **o que fazer agora, por que isso importa e como contribui para sua evolução**.

## Decisões
- **Início:** “o que faço agora?”.
- **Aulas:** “onde parei e o que aprendo a seguir?”.
- **Prática:** “o que treino agora?”.
- **Materiais:** “onde encontro o recurso de apoio?”.
- **Progresso:** “estou evoluindo?”.
- **Agenda:** “quando são meus compromissos?”.
- **Perfil:** “como gerencio minha conta?”.
- Termos fixos: **Aula** = conteúdo da trilha; **Encontro ao vivo** = sessão com professor; **Prática** = atividade de habilidade; **Gravação** = replay gravado conforme o domínio.
- Os planos diferenciam intensidade e acompanhamento, não mutilação arbitrária do portal.
- Start = constância; Talk = conversação frequente; Boost = aceleração + acompanhamento individual.
- Benefícios são autorizados por **entitlements**, não pelo nome do plano na UI.

## Invariantes
- Progresso curricular, frequência, prática e proficiência são sinais distintos.
- “56% do curso” nunca significa “56% de A2”.
- A Home agrega dados de outros domínios; não é fonte de verdade.
- Cada tela possui uma tarefa primária e evita duplicar outras áreas.
- Benefícios comerciais precisam ser traduzíveis em regras mensuráveis de backend.

## O que não fazer
- Duplicar Home, Aulas e Agenda como dashboards equivalentes.
- Esconder features fundamentais do curso para forçar upgrade.
- Inventar métricas pedagógicas sem origem e significado definidos.
- Usar labels diferentes para o mesmo conceito.

## Interfaces
[ARCHITECTURE.md](./ARCHITECTURE.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [BILLING.md](./BILLING.md) · [CEFR_ASSESSMENT.md](./CEFR_ASSESSMENT.md) · [UI_CONTRACT.md](./UI_CONTRACT.md)

## Critérios de aceitação
- Toda rota de aluno declara sua tarefa primária em uma frase.
- Nenhuma métrica de proficiência deriva diretamente do percentual do curso.
- Todo benefício pago possui entitlement explícito ou regra central equivalente.
- Nomenclatura pedagógica permanece consistente.
