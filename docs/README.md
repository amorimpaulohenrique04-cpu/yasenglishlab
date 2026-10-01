# Yas English Lab — Documentation Map

A pasta `docs/` é a fonte de verdade modular do produto e da engenharia. Use progressive disclosure: comece por este mapa e leia apenas os documentos necessários à tarefa.

## Produto e UX
- [PRODUCT.md](./PRODUCT.md) — responsabilidades de cada área, nomenclatura e princípios.
- [UI_CONTRACT.md](./UI_CONTRACT.md) — contrato visual.
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — tokens/components.
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) — responsivo e WCAG.
- [reference-ui/README.md](./reference-ui/README.md) — telas aprovadas.

## Arquitetura e dados
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATA_MODEL.md](./DATA_MODEL.md)
- [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md)
- [SECURITY.md](./SECURITY.md)

## Domínios
- [ADMIN_CONTENT.md](./ADMIN_CONTENT.md)
- [BILLING.md](./BILLING.md)
- [CEFR_ASSESSMENT.md](./CEFR_ASSESSMENT.md)
- [LIVE_CLASSES.md](./LIVE_CLASSES.md)
- [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md)
- [MATERIALS.md](./MATERIALS.md)

## Qualidade e operação
- [PERFORMANCE.md](./PERFORMANCE.md)
- [TESTING.md](./TESTING.md)
- [ANALYTICS.md](./ANALYTICS.md)
- [OBSERVABILITY.md](./OBSERVABILITY.md)
- [AUDIT_LOG.md](./AUDIT_LOG.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)
- [ROADMAP.md](./ROADMAP.md)

## Decisões
- [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) — ambiguidades que não devem ser preenchidas por inferência.
- [adr/README.md](./adr/README.md) — decisões arquiteturais futuras.

## Regra de manutenção
- Uma regra deve ter um documento autoritativo.
- Outros documentos apontam para ela em vez de copiar parágrafos inteiros.
- Se uma decisão ainda não estiver fechada, use OPEN_QUESTIONS.
- Se uma decisão estrutural for fechada, considere um ADR.
- O manual original é fonte de contexto; esta árvore é a fonte operacional modular para o repositório.
