# Operations

## Propósito
Definir princípios operacionais para ambientes, migrations, backup, incidentes e mudanças seguras antes de o produto existir em produção.

O processo executável de CI/CD está em [CI_CD.md](./CI_CD.md).

## Decisões
Ambientes oficiais:
```text
LOCAL → PREVIEW → STAGING → PRODUCTION
```

Mudanças de banco devem ser versionadas em migrations. Produção não é ambiente de experimentação manual.
Preview/staging não devem reutilizar secrets privilegiados de produção.
Backups precisam de procedimento de restore testável; “ter backup” sem restore conhecido é insuficiente.
Features de risco elevado devem admitir rollback/disable quando possível.

O CI valida migrations em banco limpo, bloqueia edição de migrations já mergeadas e executa integração/RLS reais. O release só avança a partir do SHA aprovado pelo CI.

Runbooks mínimos futuros:
- falha de pagamento;
- booking inconsistente/overbooking;
- indisponibilidade de reunião/vídeo;
- incidente de segurança;
- restore de dados;
- assessment interrompido.

## Invariantes
- Mudança de schema deixa migration revisável.
- Migration mergeada é imutável; correção usa nova migration.
- Operação manual privilegiada é excepcional e auditável.
- Incidente registra timeline/evidência suficiente para aprendizado posterior.
- Restore é exercitado, não apenas presumido.
- Produção recebe somente release associado a CI verde.

## O que não fazer
- Alterar schema de produção clicando no painel como fluxo normal.
- Compartilhar secrets entre ambientes por conveniência.
- Corrigir entitlement diretamente sem registrar motivo/evidência.
- Prometer rollback de migration destrutiva sem estratégia real.
- Fazer deploy de um SHA diferente do que passou no CI.

## Interfaces
[CI_CD.md](./CI_CD.md) · [SECURITY.md](./SECURITY.md) · [OBSERVABILITY.md](./OBSERVABILITY.md) · [TESTING.md](./TESTING.md) · [ROADMAP.md](./ROADMAP.md)

## Critérios de aceitação
- Processo de mudança é reproduzível.
- Runbooks críticos existem antes do lançamento correspondente.
- Backup/restore e incident response possuem owners quando a equipe for definida.
- Branch protection e environments do GitHub refletem os gates descritos em CI_CD.md.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

