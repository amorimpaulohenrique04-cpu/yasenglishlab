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

## 3B — webhook e reconciliação

`POST /api/webhooks/asaas` é uma Route Handler Node sem autenticação de Student.
O servidor compara `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN` antes de ler o
corpo ou construir o cliente privilegiado. Configure um authToken exclusivo,
32–255 caracteres sem espaços, diferente de `ASAAS_API_KEY`. Não é assinatura
criptográfica: é o mecanismo de autenticação documentado pelo Asaas. Corpo
limitado a 256 KiB. Token ausente/configuração inválida: 503; token inválido: 401;
JSON/evento financeiro malformado: 400; corpo excessivo: 413. Falha de storage:
503 para redelivery; resultado durável: 204, sem corpo ou logs de payload.

O normalizador server-only retém apenas provider/eventId/sourceType/occurredAt,
efeito neutro, IDs de sessão/checkout/assinatura/pagamento, centavos, moeda e data
de vencimento. A moeda é BRL pelo contrato monetário Asaas; não é um campo
presumido da resposta. Customer, CPF/CNPJ, email, telefone, cartão, tokens e o
JSON original não são persistidos. Campos novos são tolerados e descartados.

Efeitos mínimos: confirmação/recebimento → ACTIVE; atraso/falha e chargeback →
PAST_DUE apenas para assinatura conhecida; reembolso integral → EXPIRED;
assinatura inativada → EXPIRED; assinatura deletada → CANCELLED. Autorização de
cartão, criação/atualização de assinatura, checkout pago sem evidência financeira,
reembolso parcial e eventos desconhecidos são registrados como IGNORED, sem
ativação. Não há criação de TRIALING, política de reembolso parcial ou prorrata.

O RPC `reconcile_billing_event` aceita somente o contrato sanitizado e somente
service_role pode executá-lo. A transação serializa eventId, provider subscription
e usuário; deduplica `(provider,event_id)`; deriva identidade/Plan da intenção
persistida; compara centavos/moeda com seu snapshot, inclusive após alteração do
preço atual. `payment.subscription` é o ID externo da assinatura: nunca payment.id,
email ou dados do browser. `externalReference` UUID e/ou `payment.checkoutSession`
vinculam a primeira cobrança ao checkout 3A. Referências presentes que discordem
do vínculo existente são rejeitadas. CREATING pode ser conciliado após confirmação
quando externalReference comprova a intenção; seu checkout ID desconhecido é
recuperado do evento, sem reenviar POST.

Evento válido sem vínculo ou com valor divergente fica registrado com erro seguro
e sem efeito comercial. Rejeições definitivas são reconhecidas; retry do mesmo
eventId não altera sua identidade nem refaz efeitos. Não existe endpoint de replay
administrativo neste pacote. Erros de vínculo exigem inspeção operacional usando
os IDs sanitizados; nunca correlacionar por email. Eventos mais antigos e eventos
de ciclos já ultrapassados são STALE; no mesmo timestamp, o efeito restritivo tem
precedência. CANCELLED não reabre por eventos de pagamento, e um ciclo já expirado
não é reativado por recebimento tardio do mesmo ciclo.

Confirmação inicial altera sessão para PAID, espelho para ACTIVE e chama
`private.ensure_initial_placement(user_id,subscription_id)` na mesma transação.
Falha do helper reverte os três efeitos e persiste o erro. O helper não é exposto
aos papéis da API; `begin_placement` mantém a autorização Student e usa a mesma
regra. Unique user_id mantém um único case em PAYMENT_CONFIRMED; não há Enrollment
antecipado ou impersonação de Auth. Auditoria de Billing usa actor null e vínculos
provider/event/subscription/Placement. Entitlements e quotas continuam derivados
do espelho via `private.booking_entitlement`, sem condicionais por nome de plano.

### Períodos e limites operacionais

Os schemas oficiais consultados expõem vencimento da cobrança e próximo
vencimento da assinatura, mas não os limites do período contratado. Vencimento
não prova início/fim: 3B mantém `current_period_start/end` null na primeira
ativação, conforme contrato existente, sem somar dias ou alterar limites existentes.
`billing_last_cycle_date` serve somente para impedir recebimentos tardios de um
ciclo anterior de desfazer a inadimplência atual. Estado e bloqueio dependem dos
eventos financeiros confirmados; a entrega/monitoramento do webhook é requisito
operacional, sem expiração automática inferida. Follow-up: homologar em sandbox a
propagação das referências e obter limites autoritativos antes de adicionar períodos.

Asaas exemplifica `dateCreated` sem offset e não documenta seu fuso nos schemas
consultados. O normalizador projeta esse relógio de forma uniforme em UTC somente
para ordenação do feed; não afirma que a origem é UTC e não usa isso como período
financeiro. Timestamps com offset explícito são convertidos. Homologação deve
confirmar consistência do relógio da conta antes do rollout; sem chamadas reais
neste pacote. Reassinatura com um novo provider subscription reutiliza o case
único existente, preservando sua identidade e a máquina de Placement.

Fontes oficiais verificadas em 2026-10-06:
[autenticação webhook](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint),
[eventos financeiros](https://docs.asaas.com/docs/payment-events),
[schema de pagamento](https://docs.asaas.com/reference/retrieve-a-single-payment),
[eventos de assinatura](https://docs.asaas.com/docs/subscription-events).

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

