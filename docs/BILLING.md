# Plans, Entitlements & Billing

## Propósito
Separar cobrança externa de autorização interna e modelar os planos por capacidades mensuráveis.

## Decisões
- **Start — R$99,90/mês:** portal completo + teste de proficiência + 1 Core Class/semana.
- **Talk — R$179,90/mês:** tudo do Start + 1 Conversation Lab/semana, totalizando 2 encontros em grupo/semana.
- **Boost — R$329,90/mês:** tudo do Talk + 1 Lab adicional/semana, totalizando 3 encontros em grupo/semana + 1 sessão particular de 45 min/mês + acompanhamento individual.
- Grupos planejados com até 6 alunos.

```text
billing provider
   ↓ webhook verificado
subscriptions (mirror local)
   ↓
plan_entitlements
   ↓
authorization / booking / UI
```

Entitlements iniciais possíveis:
- `weekly_core_classes`
- `weekly_conversation_labs`
- `monthly_private_sessions`

O provider autorizado é **Asaas**, atrás de `BillingProvider` server-only, conforme [ADR 0013](./adr/0013-asaas-billing-provider.md). A fundação 3A cria checkout mensal BRL por cartão; Pix recorrente e boleto não são presumidos nesse endpoint.

`billing_checkout_sessions` reserva uma intenção por Student e guarda snapshot histórico de Plan. O preço vem do banco; callbacks vêm do APP_URL do servidor. Concorrência retorna pending/reutiliza READY. Resultado incerto mantém CREATING para reconciliação e não reenvia POST. READY não confirma pagamento e não altera subscriptions/entitlements. Não há rota pública no 3A; webhook e fluxo público pertencem respectivamente ao 3B/3C.

## Invariantes
- Nome do plano não é autorização espalhada pelo código.
- Redirect de checkout não libera benefício.
- Webhook é verificado e processado de forma idempotente.
- Estado local reflete evento confirmado.
- Frequências/créditos seguem política documentada.

## O que não fazer
- `if (plan === "boost")` para autorização em páginas/componentes.
- Confiar no frontend para confirmar upgrade.
- Processar evento externo duplicado com efeito duplicado.
- Alterar entitlement manualmente sem auditabilidade.

## Interfaces
[PRODUCT.md](./PRODUCT.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [LIVE_CLASSES.md](./LIVE_CLASSES.md) · [SECURITY.md](./SECURITY.md)

## Critérios de aceitação
- Benefício comercial possui entitlement ou regra central equivalente.
- Upgrade/downgrade/cancelamento dependem de estado confirmado.
- Booking consulta entitlement durável.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

