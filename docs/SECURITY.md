# Security & Privacy Baseline

## Propósito
Aplicar security by design desde o repositório, alinhando controles ao risco real do SaaS educacional e à LGPD.

## Decisões
Baseline:
- least privilege;
- RLS + autorização server-side;
- secrets apenas em runtime seguro;
- MFA para staff;
- validação server-side;
- anti-abuse/rate limiting onde necessário;
- headers de segurança quando a aplicação existir;
- webhooks assinados;
- storage privado/signed URLs para ativos protegidos;
- audit logs para operações críticas;
- dependency/secret scanning no CI futuro;
- backups + procedimento de restore.

Dados pessoais devem ter finalidade, retenção e acesso proporcionais. Senhas, tokens, credenciais de pagamento e secrets nunca entram em logs.

## Invariantes
- Autorização crítica não depende apenas do cliente.
- Ação privilegiada exige identidade e escopo suficientes.
- Secret não é commitado nem exposto no bundle.
- URL assinada é temporária e emitida após autorização/entitlement.
- Se o produto aceitar crianças, governança específica deve existir antes do lançamento dessa capacidade.

## O que não fazer
- `service_role` no browser.
- Liberar assinatura por redirect de checkout.
- Colocar signing key de meeting no cliente.
- Logar senha/token/secret/dado sensível desnecessário.
- Upload irrestrito sem validação.
- Conceder acesso amplo por conveniência operacional.

## Interfaces
[AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [BILLING.md](./BILLING.md) · [OPERATIONS.md](./OPERATIONS.md) · [TESTING.md](./TESTING.md)

## Critérios de aceitação
- Threat model específico precede features sensíveis.
- Fluxos críticos possuem testes negativos.
- Incidentes podem ser investigados sem expor secrets.
- Obrigações de privacidade relevantes aparecem nos fluxos/runbooks.
