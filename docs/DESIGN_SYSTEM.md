# Design System

## Propósito
Transformar a identidade aprovada do Yas em tokens e componentes reutilizáveis.

## Decisões
Tokens esperados: colors, typography, spacing, radius, shadow, border, breakpoints, z-index, motion.

Primitives planejadas: `Button`, `IconButton`, `Card`, `Badge`, `Tag`, `Input`, `Select`, `Checkbox`, `Radio`, `Textarea`, `Tabs`, `ProgressBar`, `ProgressRing`, `Avatar`, `Tooltip`, `Dropdown`, `Dialog`, `Drawer`, `Toast`, `Alert`, `Skeleton`, `EmptyState`, `ErrorState`, `SectionHeader`, `PageHeader`, `AppShell`, `Sidebar`, `Topbar`, `ContentContainer`.

Estados: default, hover, focus-visible, active, disabled, loading, error, success, selected.

## Invariantes
- Tokens são a API visual; páginas não inventam valores equivalentes.
- Componente novo exige diferença semântica real.
- Storybook, quando instalado, cobre mais que happy path.
- Componentes interativos têm foco visível e teclado.

## O que não fazer
- Copiar componentes entre páginas.
- CSS local para “consertar” problema de primitive.
- Múltiplos botões primários com contratos divergentes.
- Cor semântica definida apenas por valor local.

## Interfaces
[UI_CONTRACT.md](./UI_CONTRACT.md) · [ACCESSIBILITY.md](./ACCESSIBILITY.md) · [TESTING.md](./TESTING.md)

## Critérios de aceitação
- Primitive implementada possui estados necessários.
- Página nova compõe componentes existentes sempre que possível.
- Tokens substituem valores repetidos/arbitrários.

## Atualização 2026-10-16

- Tokens medidos na proposta aprovada (`src/styles/tokens.css`): sidebar `#461d82`, ativo `#6132ad`, violeta `#6024f7`, amarelo `#f9c933`, canvas `#f3effd`; tints pastel com texto AA (`--yas-tint-*`).
- Tipografia: Montserrat 700/800 para títulos (`--yas-font-display`) e Inter para corpo, via `next/font`.
- Primitivos novos: `Icon` (conjunto linear da proposta), `IconBadge`, `Hero`, `AvatarStack`, `Button` variante `soft`, `Badge` com `dot`/`icon`, `MetricCard` com ícone, utilitários `.yas-list`, `.yas-link`, `.yas-timeline`, `.yas-switch`, `.yas-reveal`.
