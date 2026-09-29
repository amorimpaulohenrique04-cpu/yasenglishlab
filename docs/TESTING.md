# Testing & QA Strategy

## Propósito
Provar comportamento, autorização e consistência visual; cobertura numérica não é objetivo isolado.

## Decisões
Camadas previstas:
- **Unit:** regras puras (entitlements, cálculos de progresso, helpers de scoring).
- **Component:** estados/interações de primitives e componentes.
- **Integration:** database/server actions/domain services.
- **RLS/Authorization:** policies reais e casos negativos.
- **E2E:** fluxos visíveis ao usuário.
- **Visual regression:** screenshots aprovados.
- **Accessibility:** automação + revisão manual.

E2E deve preferir seletores por role/label/texto visível, não classes CSS internas.

Fluxos críticos futuros incluem: login/reset; assinatura/upgrade/downgrade/cancelamento; aula/progresso; prática; assessment; booking/cancelamento/lotação; materiais; perfil; autorização negativa.

## Invariantes
- Teste falhando não vira warning para “ficar verde”.
- Segurança crítica possui caso negativo.
- Mudança visual relevante produz evidência visual.
- DB/Auth/Billing não são validados apenas por mock superficial.
- Teste reproduz comportamento, não detalhe incidental.

## O que não fazer
- Testar apenas happy path.
- E2E acoplado a classes/DOM instável.
- Snapshot massivo sem intenção.
- Cobertura alta com regras críticas sem teste.
- Alterar teste para aceitar regressão sem justificar mudança de requisito.

## Interfaces
[SECURITY.md](./SECURITY.md) · [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [UI_CONTRACT.md](./UI_CONTRACT.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)

## Critérios de aceitação
- Estratégia futura combina unit/integration/RLS/E2E/visual/a11y.
- Fluxo crítico possui evidência proporcional ao risco.
- Mudança de política RLS exige teste.
