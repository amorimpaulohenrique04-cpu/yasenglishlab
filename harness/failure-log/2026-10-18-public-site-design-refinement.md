# Failure — public-site-design-refinement verification pending

Classification: environment
Status: open
Repeatable: yes
Date: 2026-10-18
PR/commit related: current change — public-site-design-refinement

## Symptom

Gate UI e revisão visual não puderam ser concluídos para o protótipo v4. Eval de escopo também permanece vermelho por commits preexistentes.

## Evidence

`harness/evidence/public-site-design-refinement/verify-ui.log`: gate exige CANONICAL_E2E=1. Navegador bloqueou file:// na análise anterior; não há screenshots da v4.

`harness/evidence/public-site-design-refinement/eval-agent.log`: com goal correto, única regra vermelha é escopo de sete arquivos preexistentes em origin/main...HEAD. Não são alterações desta tarefa. Core/build, harness e segurança passaram conforme logs.

## Root cause

Stack canônica não configurada nesta execução; política de URL da ferramenta impede abertura do arquivo local. Não há evidência de falha visual do HTML, nem de aprovação visual.

## Responsible layer

Ambiente de verificação e política de navegação.

## Immediate fix

Implementação local e checagem estrutural registradas. Registro permanece aberto. npm padrão apontou para AppData/Roaming ausente; execução pelo npm-cli.js já instalado em Program Files permitiu checagens sem alterar o sistema.

## Permanent protection

Gate verify:ui existente preservado, fail-closed, sem bypass. Registry continua in_progress/verified:false até evidência adequada.

## Test/eval created

Gate verify:ui existente mantido. Check estático em harness/evidence/public-site-design-refinement/check-prototype.mjs não substitui a revisão visual.

## Reproduction

Executar npm run verify:ui sem CANONICAL_E2E=1 reproduz o bloqueio por pré-requisito. Não repetir a navegação bloqueada nem contornar a política via localhost/captura alternativa.

## Before/after proof

Before: verify-ui.log registra o pré-requisito ausente.

After: revisão desktop/tablet/mobile e execução canônica pendentes. Nenhuma resolução do bloqueio alegada.
