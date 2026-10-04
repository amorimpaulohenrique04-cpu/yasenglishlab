# Audit Log

## Propósito

Registrar fatos duráveis sobre ações privilegiadas/relevantes. Audit log responde **quem alterou o quê e quando**, com correlação suficiente para reconstruir a operação.

Ele não é product analytics e não é error reporting.

## Ações privilegiadas oficiais

A taxonomia server-side vive em `src/server/audit/actions.ts`.

| Action | Quando registrar |
| --- | --- |
| `role_change` | grant/revoke de role |
| `entitlement_change` | alteração manual/configurada de entitlement de usuário |
| `manual_subscription_change` | intervenção administrativa em assinatura |
| `teacher_assignment` | professor atribuído/removido de aluno |
| `teacher_provisioned` | identidade Auth reconciliada com role `TEACHER` e registro operacional |
| `teacher_activated` / `teacher_deactivated` | estado operacional alterado após validação de dependências |
| `teacher_course_capability_changed` | capacidade de atender um Course publicada adicionada/removida |
| `cohort_primary_teacher_changed` | Teacher principal operacional de uma cohort alterado |
| `CRM_CREATE`, `CRM_UPDATE`, `CRM_STAGE`, `CRM_LINK_USER`, `CRM_INTERACTION`, `CRM_TASK`, `CRM_COMPLETE_TASK` | lead, etapa, vínculo existente ou follow-up operacional alterado |
| `assessment_publication` | versão publicada/retirada por staff |
| `admin_data_export` | export administrativo de dados |
| `content_created` | criação DRAFT nas entidades educacionais existentes |
| `content_updated` | edição de DRAFT, sem copiar conteúdo para audit |
| `content_published` | transição validada DRAFT → PUBLISHED |
| `content_unpublished` | transição PUBLISHED → DRAFT |
| `content_reordered` | permutação atômica de positions no mesmo parent |

Admin Content grava esses fatos na mesma transação das RPCs autenticadas; falha de audit desfaz a mutação. Ator vem de auth.uid(); correlação request_id/environment/version segue o contexto server-only existente. Payload contém somente campos alterados, estados ou IDs/posições; nunca body, gabarito, secrets, signed URL ou storage path.

Hoje `role_change` já está conectado ao serviço de administração. Os demais nomes são contrato para as features futuras e não significam que essas telas/fluxos já existam.

Eventos de segurança/recurso já auditados também incluem `live_session_booked` e `protected_asset_access_granted`.

## Contexto persistido

`writeAuditLog()` grava:

- `actor_user_id`;
- `action`;
- `entity_type`;
- `entity_id` quando aplicável;
- `data` allowlisted/sanitizado;
- `request_id`;
- `environment`;
- `version`;
- `occurred_at`.

`audit_logs` permanece append-only: update/delete são bloqueados.

## Privacidade

Audit payload deve conter somente dados necessários para explicar a ação. Nunca incluir:

- password;
- token/JWT/cookie;
- payment credentials;
- signed URL/storage path privado;
- private audio;
- resposta sensível de assessment;
- secret;
- payload bruto de billing.

O writer aplica o mesmo sanitizer da observability antes de persistir `data`.

## Exemplo

```json
{
  "action": "role_change",
  "actor_user_id": "<uuid>",
  "entity_type": "user_roles",
  "data": {
    "operation": "grant",
    "target_user_id": "<uuid>",
    "role": "TEACHER"
  },
  "request_id": "<uuid>",
  "environment": "production",
  "version": "<release-sha>"
}
```

## Invariantes

- Operação privilegiada relevante gera audit fact durável.
- Histórico não é reescrito.
- Audit log não é usado como analytics.
- Erro técnico ao gravar audit produz observability `database_error` com impacto `data_integrity_risk`.
- O client nunca decide `actor_user_id`.

## Interfaces

[OBSERVABILITY.md](./OBSERVABILITY.md) · [SECURITY.md](./SECURITY.md) · [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [OPERATIONS.md](./OPERATIONS.md)


## Teacher attendance

Teacher Operations V1 registra `attendance_marked` como fato de auditoria explícito. A gravação é feita por trigger no mesmo statement/transação do upsert de `attendance`, portanto a operação não pode ser declarada bem-sucedida se o audit insert falhar.

O actor é `auth.uid()`; o payload contém somente `live_session_id`, `session_booking_id`, `previous_status` quando aplicável e `new_status`. Nome, e-mail, telefone, JWT/cookie/token, meeting data, billing e respostas de assessment não são copiados para o audit.

Esse caminho transacional usa os defaults existentes de correlação quando não há request context disponível no PostgreSQL e não cria um segundo sistema de logs.

## P21 foundation closure

The additive P21.1–P21.3 contracts and verification are documented in [P21 foundation](P21_FOUNDATION.md) and ADRs 0007–0009. The prior domain contracts remain applicable.

