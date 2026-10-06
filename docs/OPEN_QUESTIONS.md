# Open Questions

Este arquivo registra decisões ainda **não fechadas**. Coding agents não devem preenchê-las por inferência; uma decisão relevante deve ser confirmada e, quando estrutural, registrada em ADR.

## Providers / infraestrutura
- Encontros ao vivo V1: Zoom, Google Meet ou outra solução?
- Hosting/deploy definitivo: manter direção Vercel ou escolher alternativa?
- Analytics de produto: PostHog ou alternativa?
- Error reporting/tracing: stack exata de observabilidade?

## Produto / pedagogia
- Qual a política final de reaplicação do Teste de Proficiência: por tempo, módulos concluídos ou ambos?
- Qual metodologia de standard setting/cut scores será adotada após pilotagem CEFR?
- P21.2 fechou o consumo WEEK/MONTH por início da sessão em America/Recife, cancelamento Student antecipado libera uso, tardio mantém, NO_SHOW mantém e Teacher cancellation libera (ADR 0008). Quais regras futuras de remarcação/reposição excepcional serão adotadas?
- Há carry-over ou reposição excepcional de créditos além das janelas semanais/mensais aprovadas no P21.2? Essas extensões continuam fora do escopo.
- O Yas aceitará menores de idade no MVP? Se sim, qual modelo de guardian/consentimento?
- Quais recursos exatos diferenciam suporte/prioridade do Talk e Boost sem conflitar com os entitlements já definidos?

## Operação / conteúdo
- Teacher Operations V1 já cobre sessões próprias, roster mínimo e attendance. Quando entra o Teacher Portal amplo/autoria? Admin Content V1 foi autorizado explicitamente no P18 (ADR 0006); CMS genérico continua fora do escopo.
- Quem pode publicar/editar uma versão de assessment?
- Qual fluxo futuro de revisão pedagógica após Admin Content V1? No V1, ADMIN+AAL2 publica diretamente sem aprovação obrigatória (ADR 0006); esta evolução não bloqueia P18.

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
