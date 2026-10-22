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
- Tipografia: Montserrat 700/800 para títulos (`--yas-font-display`) e Inter para corpo. WOFF2 versionados em `public/fonts/`, com subsets, métricas de fallback e preload Latin preservados em `src/app/fonts.css` e no layout. Isso evita o defeito de URLs Google Fonts no Next 16.3.8 (upstream #99114); os bytes e pesos da tipografia permanecem os mesmos.
- Primitivos novos: `Icon` (conjunto linear da proposta), `IconBadge`, `Hero`, `AvatarStack`, `Button` variante `soft`, `Badge` com `dot`/`icon`, `MetricCard` com ícone, utilitários `.yas-list`, `.yas-link`, `.yas-timeline`, `.yas-switch`, `.yas-reveal`.

## Atualização 2026-10-22 — movimento e primitivos de operação

- **Movimento.** `motion@13.5.1` (`motion/react`) roda dentro de `MotionProvider` (`src/components/motion`), com `LazyMotion strict` (apenas componentes `m.*`) e `MotionConfig reducedMotion="user"`. As molas ficam em `yasTokens.motion.springs` (`snappy`, `gentle`, `sheet`). As curvas CSS novas são `--yas-ease-sheet` (painéis) e `--yas-ease-out` (revelações).
- **Regras de movimento:**
  - Interações ficam abaixo de 300 ms; revelações de dados até cerca de 1,1 s.
  - O movimento segue a direção da navegação: avançar entra pela direita.
  - Sheets sobem como tela cheia no celular.
  - Todo movimento tem equivalente sem animação: os tokens CSS vão a 1 ms e o motion respeita a preferência do usuário.
  - O primeiro render no servidor já mostra o valor final, então números e gráficos estão corretos sem JavaScript.
- **Primitivos estendidos:**
  - `Tabs`: `variant="underline"` com indicador deslizante e `badge` decorativo; o rótulo continua sendo o nome acessível.
  - `Drawer`: `size` `md`/`lg`/`xl`, `icon`, `footer` fixo e animação de saída antes do `close()` nativo, que devolve o foco a quem abriu.
  - `Dialog`: `icon` e `footer`.
  - `Dropdown`: itens com `href`/`icon`, gatilho `iconOnly`, `triggerVariant="primary"`, e Esc devolve o foco.
- **Primitivos novos (com diferença semântica):**
  - `SegmentedNav`: troca de visão feita de links, em que cada opção é uma URL; não é um tabpanel.
  - `Breadcrumbs`: landmark de navegação.
  - `Stepper`: progresso ordenado de uma tarefa.
  - `ToastProvider` e `useToast`: fila de confirmações transitórias.
  - `CommandPalette`: busca global via Ctrl/⌘ K, como combobox ARIA.
  - `AnimatedNumber`: contagem de KPIs.
