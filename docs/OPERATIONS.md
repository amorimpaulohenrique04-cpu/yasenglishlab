# Operations

## Propósito
Definir princípios operacionais para ambientes, migrations, backup, incidentes e mudanças seguras antes de o produto existir em produção.

## Decisões
Ambientes planejados:
```text
LOCAL → PREVIEW → STAGING → PRODUCTION
```

Mudanças de banco devem ser versionadas em migrations. Produção não é ambiente de experimentação manual.
Preview/staging não devem reutilizar secrets privilegiados de produção.
Backups precisam de procedimento de restore testável; “ter backup” sem restore conhecido é insuficiente.
Features de risco elevado devem admitir rollback/disable quando possível.

Runbooks mínimos futuros:
- falha de pagamento;
- booking inconsistente/overbooking;
- indisponibilidade de reunião/vídeo;
- incidente de segurança;
- restore de dados;
- assessment interrompido.

## Invariantes
- Mudança de schema deixa migration revisável.
- Operação manual privilegiada é excepcional e auditável.
- Incidente registra timeline/evidência suficiente para aprendizado posterior.
- Restore é exercitado, não apenas presumido.

## O que não fazer
- Alterar schema de produção clicando no painel como fluxo normal.
- Compartilhar secrets entre ambientes por conveniência.
- Corrigir entitlement diretamente sem registrar motivo/evidência.
- Prometer rollback de migration destrutiva sem estratégia real.

## Interfaces
[SECURITY.md](./SECURITY.md) · [OBSERVABILITY.md](./OBSERVABILITY.md) · [TESTING.md](./TESTING.md) · [ROADMAP.md](./ROADMAP.md)

## Critérios de aceitação
- Processo de mudança é reproduzível.
- Runbooks críticos existem antes do lançamento correspondente.
- Backup/restore e incident response possuem owners quando a equipe for definida.
