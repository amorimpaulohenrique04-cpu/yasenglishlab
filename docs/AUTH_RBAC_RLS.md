# Authentication, RBAC & RLS

## Propósito
Separar autenticação (“quem é?”) de autorização (“o que pode fazer?”) e proteger contra cliente malicioso.

## Decisões
Roles-base:
- **STUDENT:** próprios dados, matrícula, progresso, materiais permitidos, bookings e resultados.
- **TEACHER:** sessões/turmas atribuídas, presença e contexto pedagógico necessário dos alunos vinculados.
- **SUPPORT:** mínimo necessário para atendimento.
- **ADMIN:** operações administrativas explícitas e auditáveis.

Autenticação prevista via Supabase Auth.
Autorização combina validação server-side, grants/policies PostgreSQL RLS e DTOs mínimos.
MFA para staff é direção de segurança; detalhes de rollout ficam em [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

## Invariantes
- Browser nunca é autoridade para user_id, role ou entitlement.
- Ocultar botão não é autorização.
- Tabelas expostas com dados de usuário têm RLS.
- `service_role` nunca chega ao cliente.
- Teacher não lê aluno não atribuído apenas por conhecer ID.
- Operações privilegiadas relevantes são auditáveis.

## O que não fazer
- Role check somente em React.
- Confiar em user_id do browser sem vincular a identidade autenticada.
- Desabilitar RLS para “resolver” integração.
- Dar SUPPORT acesso total por conveniência.

## Interfaces
[SECURITY.md](./SECURITY.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [BILLING.md](./BILLING.md) · [TESTING.md](./TESTING.md)

## Critérios de aceitação
- Student A não acessa dados privados de Student B.
- Teacher só alcança estudantes permitidos.
- Anonymous não acessa recursos protegidos.
- Mudança privilegiada é autorizada e auditável.
- Policies futuras possuem testes.
