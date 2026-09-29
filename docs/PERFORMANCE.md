# Performance & Reliability

## Propósito
Tratar velocidade e estabilidade como parte da experiência do aluno, com metas observáveis em campo.

## Decisões
Metas de referência para Core Web Vitals:
- LCP ≤ 2,5 s.
- INP ≤ 200 ms.
- CLS ≤ 0,1.
As metas devem ser avaliadas no 75º percentil em dados de campo quando houver volume.

Direções:
- Server Components por padrão.
- Lazy-load de charts, calendário, vídeo e editores pesados.
- Imagens otimizadas.
- Streaming de vídeo especializado, não MP4 gigante servido pela app.
- Skeletons para dashboard/módulos/prática/agenda/progresso.
- Cache somente quando coerente com autorização e frescor.
- Timeouts/retries controlados em integrações.

## Invariantes
- Performance não pode quebrar autorização/cache de dados privados.
- Loading state não causa saltos de layout evitáveis.
- Retry só ocorre para falha recuperável e operação idempotente.
- Bundle/client JS deve permanecer intencional.

## O que não fazer
- Transformar toda tela em Client Component por conveniência.
- Carregar charts/calendário/vídeo antes de serem necessários.
- Cachear resposta privada sem chave/escopo correto.
- Spinner global longo quando skeleton/progressive rendering resolve.

## Interfaces
[ARCHITECTURE.md](./ARCHITECTURE.md) · [OBSERVABILITY.md](./OBSERVABILITY.md) · [TESTING.md](./TESTING.md) · [OPERATIONS.md](./OPERATIONS.md)

## Critérios de aceitação
- Features críticas têm orçamento/medição de performance quando implementadas.
- Regressões relevantes são identificáveis no CI/observabilidade conforme maturidade.
- Nenhuma otimização viola segurança ou consistência.
