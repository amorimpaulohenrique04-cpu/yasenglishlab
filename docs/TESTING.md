# Testing & QA Strategy

## Propósito

Impedir regressões de comportamento, autorização, acessibilidade e UI com uma cadeia fail-closed. Cobertura numérica isolada não é objetivo.

## Matriz em cinco camadas

| Camada | O que prova | Ferramenta / fonte | Comando principal | Local | CI |
| --- | --- | --- | --- | --- | --- |
| Unit | lógica determinística e contratos puros | Vitest | `npm run test:unit` | sim | sim |
| Integration | application/domain services, Server Actions e boundaries mockadas; persistência real quando há banco | Vitest + PostgreSQL | `npm run test:integration` + `npm run test:integration:db` | sim | sim |
| RLS / authorization | policies reais e casos allow/deny | PostgreSQL SQL tests | `npm run test:rls` | sim, com DB migrado | sim |
| E2E | comportamento visível ao usuário | Playwright + Supabase local | `npm run test:e2e` | sim, com fixture | sim |
| Visual regression | pixels aprovados de Login/Home/Aulas | Playwright `toHaveScreenshot` | `npm run test:visual:golden` | sim, com fixture | sim |

Acessibilidade é um gate transversal. `npm run test:a11y` usa axe e assertions explícitas de landmarks, labels, teclado e foco nos fluxos críticos.

## Comandos

### Gate rápido

```bash
npm run verify:core
```

Executa: format check → lint → typecheck → unit → integration em memória/mocks adequados → contrato estrutural de DB → build.

Tempo típico: **1–4 min local** e **1–3 min em runner aquecido**.

### Gate não-UI completo

```bash
DATABASE_URL=postgresql://... npm run verify
```

Executa `verify:core` e acrescenta integration SQL + RLS reais. O comando falha com exit code diferente de zero quando `DATABASE_URL` não existe; não converte a ausência de banco em warning.

Tempo típico: **2–6 min**, dependendo do banco.

### Full verification

```bash
npm run verify:full
```

Pré-requisitos locais: Docker, Supabase CLI, PostgreSQL client e Chromium do Playwright.

O comando sobe Supabase local, reseta migrations/seed, executa `npm run verify`, harness/security/evals, E2E, a11y, Storybook visual e golden visual. Depois encerra o Supabase local.

Tempo típico: **8–15 min local/CI** em primeira execução; cache reduz instalação, mas não remove os testes.

### Comandos específicos

```bash
npm run test:unit
npm run test:integration
npm run test:integration:db
npm run test:rls
npm run test:e2e
npm run test:a11y
npm run test:visual:storybook
npm run test:visual:golden
npm run eval:agent
```

`test:integration:db` e `test:rls` usam `DATABASE_URL` quando fornecida; sem ela, usam as variáveis padrão do `psql`.

## Unit

Use para funções determinísticas: progresso, seleção do próximo item, validações e regras que não precisam de I/O.

Não mockar o que é puramente determinístico.

## Integration

Há dois níveis intencionais:

1. **Vitest integration**: prova orchestration entre application/domain, repositories ports, analytics ports e Server Actions. Boundaries externos podem ser mockados quando o contrato é o objeto do teste.
2. **DB integration**: `supabase/tests/domain_invariants.sql` e `vertical_slice_persistence.sql` rodam contra PostgreSQL real, migrations e seed reais.

Mocks não substituem DB/Auth/RLS onde a segurança ou persistência dependem do banco.

## RLS / authorization

A evidência executável vive em `supabase/tests/rls_permissions.sql`.

Inclui casos positivos e negativos como:
- Student A → próprio progresso = allow;
- Student A → progresso de Student B = deny;
- Teacher atribuído → allow;
- Teacher não relacionado → deny;
- Support → dados privilegiados = deny;
- Anonymous → registros protegidos = deny;
- mutação direta de progresso/roles/entitlements/bookings = deny.

Mudança de policy sem atualização de teste RLS é bloqueada pelo behavioral eval.

## E2E

Playwright usa seletores por role/label/texto visível.

Fluxo canônico:
login → Home → Aulas → módulo → aula → progresso → logout → login → retomada persistida → conclusão.

O E2E usa Supabase local real e usuário de desenvolvimento criado em runtime. Credenciais de teste são geradas por execução, não commitadas.

## Acessibilidade

`tests/a11y/critical-flows.spec.ts` cobre Login/Home/Aulas em desktop e mobile.

Automatizado:
- landmarks;
- labels;
- ordem/foco básico por teclado;
- navegação focável;
- axe WCAG A/AA, incluindo regras de contraste quando o engine consegue calcular;
- violações semânticas óbvias.

Revisão manual continua necessária para qualidade de leitura, ordem cognitiva complexa e aspectos que axe não consegue inferir.

## Golden visual tests

Baselines versionados ficam em:

```text
tests/visual/goldens/
  desktop/
    login.png
    home.png
    aulas.png
  tablet/
    login.png
    home.png
    aulas.png
  mobile/
    login.png
    home.png
    aulas.png
```

`npm run test:visual:golden` compara a UI atual com esses arquivos e falha em diferença acima da tolerância definida.

Para uma mudança visual intencional:

```bash
npm run test:visual:update
npm run test:visual:golden
```

A atualização do baseline deve ser revisada como mudança de produto, nunca usada para esconder regressão.

Quando novas telas forem implementadas, adicione casos ao mesmo spec/config e baselines por viewport; não crie um segundo sistema visual.

## Behavioral evals do coding agent

`npm run eval:agent` compara GOAL, diff e registry. Automatiza, quando possível:
- docs obrigatórios declarados;
- arquivos fora do escopo;
- skips/fixmes/supressões novas;
- UI sem evidência visual;
- DB sem migration;
- RLS sem teste;
- secrets de alta confiança;
- sucesso sem verification evidence;
- inconsistência entre registry e evidência.

Duas áreas permanecem explicitamente manuais:
- provar que o agente realmente **entendeu** os docs, e não apenas os listou;
- decidir se um novo primitive é semanticamente duplicado apesar de nome diferente.

Detalhes: `harness/evals/AUTOMATION.md`.

## Falha proposital

A infraestrutura deve manter evidência de ao menos uma regressão deliberada detectada e posteriormente corrigida. A prova final do PROMPT 08 fica em `harness/evidence/prompt-08-testing-evals/` com URLs dos runs vermelho e verde.

## Invariantes

- Qualquer erro detectado automaticamente retorna exit code ≠ 0.
- Teste falhando não vira warning para “ficar verde”.
- `.skip`, `.fixme` ou atualização de baseline não são correções de regressão.
- Segurança crítica possui caso negativo.
- Mudança visual relevante produz evidência visual.
- DB/Auth não são validados apenas por mock superficial.
- Teste reproduz comportamento, não detalhe incidental.

## Interfaces

[SECURITY.md](./SECURITY.md) · [AUTH_RBAC_RLS.md](./AUTH_RBAC_RLS.md) · [UI_CONTRACT.md](./UI_CONTRACT.md) · [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md)

## Critérios de aceitação

- Cinco camadas são executáveis separadamente.
- `verify` inclui lint, typecheck, unit, integration, RLS e build.
- `verify:full` acrescenta E2E, a11y e visual.
- Golden baselines existem para Login/Home/Aulas em desktop/tablet/mobile.
- CI bloqueia regressão em qualquer gate obrigatório.
