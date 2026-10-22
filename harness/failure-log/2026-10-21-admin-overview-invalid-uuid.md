# Failure — Visão geral do admin cai em "A área administrativa não carregou"

Classification: state  
Status: open  
Repeatable: yes (no banco local atual)  
Date: 2026-10-21  
PR/commit related: branch style/sidebar-fit (admin-teacher-redesign). A tela `/admin` não foi alterada nesta tarefa.

## Symptom

`/admin` renderiza o error boundary "A área administrativa não carregou". O e2e `tests/e2e/admin-plans-alerts.spec.ts:157` ("overview exposes actionable alerts…") falha porque não encontra a região "Alertas operacionais". Os outros 4 testes da mesma rodada passaram (planos, avaliações, cobrança).

## Evidence

- `.next/dev/logs/next-development.log`: `⨯ [{ "code": "invalid_format", "format": "uuid", "path": ["id"], "message": "Invalid UUID" }]`, um erro de parse do zod num loader server-side.
- `test-results/admin-plans-alerts-Stage-1-bdf8c-…/test-failed-1.png`
- A captura de `/admin` em 2026-10-21 mostra o mesmo erro antes de qualquer mudança desta tarefa no admin. A primeira captura foi feita só com a correção da sidebar aplicada.

## Root cause

O banco local tem linhas de fixture com UUIDs fora do padrão RFC 4122: o nibble de versão é 0, como em `83300000-0000-0000-0000-000000000001`. Elas aparecem em `public.cohorts.id`, `teachers.id/user_id`, `enrollments.id/user_id`, `live_sessions.id/teacher_id` e `profiles.user_id`. Os loaders validam com `z.uuid()` (versão 1-8) e lançam erro. Por isso `/admin` e `/admin/cohorts` caem no error boundary. O mesmo motivo faz `tests/e2e/admin-cohorts.spec.ts` falhar ao procurar "Nome, código ou curso". Essas linhas não vêm do `setup-canonical-e2e` (que usa ids v4); provavelmente sobraram de outras suítes/fixtures neste banco local.

## Responsible layer

application/database (loader da visão geral + dados locais). Fora do escopo "somente design".

## Immediate fix

Nenhum, porque é fora do escopo "somente design". Opções para o dono: (a) recriar o banco local (`supabase db reset` + `setup-canonical-e2e`), o que é destrutivo, ou (b) uma tarefa própria para decidir se as fixtures devem usar UUID v4 ou se os loaders devem aceitar UUIDs "não RFC".

## Permanent protection

Pendente: definir na tarefa de correção.

## Test/eval created

Pendente: `admin-plans-alerts.spec.ts:157` já detecta o problema.

## Reproduction

Com o Supabase local deste projeto, faça login como canonical.admin e abra `/admin`.
