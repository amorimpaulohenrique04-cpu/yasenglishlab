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
- Aluno com assinatura `PAST_DUE` (acesso suspenso, ADR 0016): qual é o caminho oficial de regularização? Link de segunda via/pagamento do Asaas na área do aluno, ou orientação ao suporte? Enquanto não decidido, a UI mostra apenas orientação textual, sem URL.
- Cancelamento de assinatura feito direto no Asaas (fora do produto): o webhook `SUBSCRIPTION_DELETED` marca `CANCELLED` sem `current_period_end`, e o acesso encerra na hora (ADR 0015/0016). Esse é o comportamento desejado, ou o acesso deve seguir até o fim do ciclo pago também nesse caso?
- Concessões de acesso de cortesia (ADR 0017) liberam só o acesso base. Devem também conceder entitlements de plano (conteúdo ou encontros com `required_entitlement_key`)? Se sim, com qual plano de referência?
- Curso concluído (ADR 0018): aulas publicadas depois da conclusão devem reabrir a matrícula (`COMPLETED` → `ACTIVE`)? Hoje não reabrem.
- Cancelamento pelo aluno (etapa 4d): (a) `DELETE /v3/subscriptions/{id}` retorna 404 para assinatura já removida e o adaptador trata como sucesso; confirmar em sandbox que 404 nunca ocorre por id de outro ambiente/conta. (b) Assinatura `ACTIVE` sem `provider_subscription_id` (seed/legado): hoje o servidor só grava o marcador e não chama o Asaas; qual a política (bloquear o cancelamento ou tratar como cancelamento local)? (c) Corrida rara: duas requisições simultâneas, a primeira falha no Asaas e reverte enquanto a segunda cancela com sucesso; o webhook então grava `CANCELLED` sem `current_period_end` (sem acesso residual). Aceitar o risco ou reforçar no banco?

## Operação / conteúdo
- A autoria de práticas do professor foi autorizada na Etapa 12 (ADR 0020); sessões próprias, roster e attendance já existem. Quais funções adicionais comporão o Teacher Portal amplo? CMS genérico continua fora do escopo.
- Qual fluxo futuro de revisão pedagógica após Admin Content V1? No V1, ADMIN+AAL2 publica diretamente sem aprovação obrigatória (ADR 0006); esta evolução não bloqueia P18.
- Qual é o canal oficial de suporte (e-mail/WhatsApp/URL) para alunos com pagamento expirado ou não confirmado em `/billing/return`? Até a decisão, a página só orienta a falar com o suporte, sem link inventado.

## Segurança
- Procedimento operacional de recuperação/break-glass para staff que perdeu o segundo fator, sem desabilitar a exigência AAL2 em runtime.
- Política de retenção/deleção para gravações, avaliações e audit logs.
- Classificação de dados e tempos de retenção por domínio.
- Confirmar no Supabase hospedado se updateUser(password) exige aal2 quando há fator MFA inscrito.

## Regra
Enquanto uma questão estiver aqui:
1. não invente resposta;
2. não espalhe dependência dessa resposta pelo código;
3. prefira interface/adapter reversível quando necessário;
4. ao decidir, remova daqui e atualize o documento/ADR correspondente.
