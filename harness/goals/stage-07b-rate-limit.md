# Etapa 7b-1 - limitador de taxa no Postgres

Objetivo: limitar signup, forgot-password e criacao de checkout contra abuso (diagnostico P2-2) sem servico externo nem dependencia nova.

Entrega (somente SQL + testes):

- `public.rate_limit_counters` (RLS ligada, sem policies, sem grants a anon/authenticated/service_role); chave ja chega como sha256 hex, nunca IP/e-mail em claro.
- `public.consume_rate_limit(p_bucket text, p_key_hash text, p_limit integer, p_window_seconds integer) returns jsonb`: janela fixa atomica; execute somente `service_role`; parametros invalidos -> `22023`.
- Retorno: `{allowed, hits, limit, retry_after_seconds}`; limpeza oportunista (~2% das chamadas, max 100 linhas > 2 dias, skip locked).
- Teste: `supabase/tests/rate_limit.sql` (transacional, rollback), suites `integration`, `rls` e `rate-limit`.

Notas:

- Os limites (numeros e janelas) sao decididos no app, nao no banco.
- Janela fixa permite rajada de ate 2x o limite na virada de janela - risco aceito.

Fora de escopo: integracao no app (7b-2), servico externo, rate limit por IP na borda.

Verificacao real: job Database do CI (sem docker local).
