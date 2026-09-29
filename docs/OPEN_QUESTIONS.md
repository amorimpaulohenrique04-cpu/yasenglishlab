# Open Questions

Este arquivo registra decisões ainda **não fechadas**. Coding agents não devem preenchê-las por inferência; uma decisão relevante deve ser confirmada e, quando estrutural, registrada em ADR.

## Providers / infraestrutura
- Qual será o provider definitivo de billing recorrente?
- Vídeo protegido: Mux, Cloudflare Stream ou outra solução?
- Encontros ao vivo V1: Zoom, Google Meet ou outra solução?
- Hosting/deploy definitivo: manter direção Vercel ou escolher alternativa? O PROMPT 09 usa Vercel apenas como adapter reversível de referência; a decisão continua aberta.
- Analytics de produto: PostHog ou alternativa?
- Error reporting/tracing: stack exata de observabilidade?

## Produto / pedagogia
- Qual a política final de reaplicação do Teste de Proficiência: por tempo, módulos concluídos ou ambos?
- Qual metodologia de standard setting/cut scores será adotada após pilotagem CEFR?
- Como Speaking e Pronunciation serão avaliados no primeiro release: humano, híbrido ou outro modelo validado?
- Quais regras exatas de cancelamento/remarcação/no-show para Core, Lab e Private?
- Créditos de encontros expiram por semana/mês? Há reposição em casos específicos?
- O Yas aceitará menores de idade no MVP? Se sim, qual modelo de guardian/consentimento?
- Quais recursos exatos diferenciam suporte/prioridade do Talk e Boost sem conflitar com os entitlements já definidos?

## Operação / conteúdo
- Quando entram Teacher Portal e Admin CMS de autoria?
- Quem pode publicar/editar uma versão de assessment?
- Qual fluxo de revisão pedagógica antes de publicar aula/material/prática?

## Segurança
- Procedimento operacional de recuperação/break-glass para staff que perdeu o segundo fator, sem desabilitar a exigência AAL2 em runtime.
- Política de retenção/deleção para gravações, avaliações e audit logs.
- Classificação de dados e tempos de retenção por domínio.

## Regra
Enquanto uma questão estiver aqui:
1. não invente resposta;
2. não espalhe dependência dessa resposta pelo código;
3. prefira interface/adapter reversível quando necessário;
4. ao decidir, remova daqui e atualize o documento/ADR correspondente.
