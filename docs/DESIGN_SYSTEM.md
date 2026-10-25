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

## Atualização 2026-10-22 — campos de data, hora e listas

- **`Popover`**: superfície ancorada na Popover API nativa. Fica na camada superior, então `overflow` não a corta (era o caso do menu "⋯" das sessões). Fecha com Esc ou clique fora e devolve o foco ao gatilho. O `Dropdown` passou a usá-lo.
- **Calendário próprio**:
  - `Calendar`: grade no padrão ARIA de date picker, com setas, PageUp/PageDown e Home/End.
  - `DatePicker`: um botão que abre o calendário.
  - `DateField`: campo digitável em dd/mm/aaaa (também aceita ISO) com botão de calendário; o formulário recebe ISO por um input oculto.
  - `DateRangePicker`: atalhos de período mais seleção de início e término.
- **`TimeField`**: campo digitável em hh:mm com uma lista de 15 em 15 minutos. Com `anchor`, a lista abre uma hora depois do início e mostra a duração de cada opção.
- **Selects**: todos os `<select>` do Yas usam `appearance: base-select`. A lista e o ✓ seguem o visual do Yas, e o elemento continua nativo: formulários, teclado, leitores de tela, picker do celular e o `selectOption` dos testes funcionam como antes. Navegadores sem suporte mostram a lista nativa.
- **Rolagem**: com um modal aberto, a página para de rolar e mantém o espaço da barra, então só aparece uma barra de rolagem. As barras internas são finas, em `--yas-color-purple-200`.

## Atualização 2026-10-22 — responsividade por container queries

- A aba Sessões se adapta pela largura de cada região (`@container`), não pela da tela. Os containers nomeados são:
  - `page`: grade principal, coluna lateral, assistente, detalhes e gráficos;
  - `toolbar`: barra de filtros e navegação;
  - `rows`: linhas da agenda e card da próxima sessão;
  - `board`: grade semanal e mensal;
  - `hero`: cabeçalho dos detalhes;
  - `card` e `panel`: cards laterais e painéis;
  - `form`: assistente e painel de edição;
  - `filters`: filtros dos relatórios.
- Assim o mesmo componente funciona com a sidebar aberta ou fechada, dentro de um sheet (a grade semanal da disponibilidade) e de 320 a 1920 px sem rolagem horizontal.
- Grids fluidos usam `repeat(auto-fit, minmax(min(100%, X), 1fr))`, títulos usam `clamp()` com `cqi`, e textos longos quebram com segurança (`overflow-wrap: anywhere`, `min-width: 0`).
- `@media` fica reservado ao que de fato depende da tela: o sheet em tela cheia no celular e `prefers-reduced-motion`.

## Atualização 2026-10-24 — `Avatar` com tom neutro

- `Avatar` aceita `tone?: "brand" | "neutral"`. O padrão é `brand`, o tint lilás de antes, então quem já usa o primitivo não muda.
- `neutral` usa `--yas-tint-grey` com `--yas-tint-grey-ink` (cerca de 5:1). Vale para listas densas de pessoas, como os alunos do professor e as próximas ações, onde o roxo fica reservado a botões, links, seleção, foco e progresso.
- A regra fica em `.yas-avatar[data-tone="neutral"]`, em `src/styles/design-system.css`.
