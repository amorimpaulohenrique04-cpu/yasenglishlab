# Responsive Design & Accessibility

## Propósito
Definir responsividade e acessibilidade como parte do contrato do produto, não auditoria tardia.

## Decisões
Alvo: **WCAG 2.2 AA** para fluxos críticos.

Recomposição mobile:
- Sidebar desktop → bottom navigation ou drawer conforme implementação aprovada.
- Colunas secundárias → stack abaixo do conteúdo principal.
- Tabelas densas → ListRows/accordions.
- Calendário semanal → visão adequada ao espaço, sem sete colunas ilegíveis.
- CTAs e estados principais permanecem evidentes.

Requisitos gerais:
- navegação por teclado;
- focus visible;
- labels reais em inputs;
- headings/landmarks semânticos;
- contraste adequado;
- alt em imagens relevantes;
- reduced motion quando aplicável;
- zoom e reflow;
- touch targets adequados;
- captions/transcripts quando necessários ao conteúdo.

## Invariantes
- Mobile não é desktop reduzido.
- Cor não é o único sinal de status.
- Componente interativo deve ser operável sem mouse.
- Acessibilidade faz parte da Definition of Done.

## O que não fazer
- Remover funcionalidade essencial no mobile apenas por falta de espaço.
- Placeholder como único label.
- Focus invisível.
- Status “verde = concluído” sem texto/ícone semântico.
- Usar ARIA para corrigir HTML semântico mal escolhido quando elemento nativo resolve.

## Interfaces
[UI_CONTRACT.md](./UI_CONTRACT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [TESTING.md](./TESTING.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)

## Critérios de aceitação
- Fluxos críticos funcionam por teclado.
- Layout principal mantém legibilidade e ordem lógica em desktop/tablet/mobile.
- Testes automatizados de a11y cobrem o que é automatizável, complementados por revisão manual.
