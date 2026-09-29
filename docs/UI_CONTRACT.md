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
