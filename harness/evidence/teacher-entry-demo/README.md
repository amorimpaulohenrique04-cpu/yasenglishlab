# Evidência — dados fictícios na Entrada do Teacher

Em 2026-10-23 o seed local focado criou Ana Martins, Bruno Oliveira, Carolina Santos e Diego Pereira, todos com sufixo Demo. E-mails exclusivos *.entry-demo@example.test e metadata teacher-entry-demo-v1. São quatro casos REVIEW_PENDING, cada um com duas respostas, sem nível CEFR atribuído nem recomendação finalizada.

- Execução: `seed.log`; repetições: `seed-repeat.log` e `seed-final.log`, mesmos quatro case IDs e 4 visíveis na fila Teacher+AAL2.
- Banco: get_placement_queue executado com role authenticated e claims do professor local. Cada caso pendente deve aparecer na fila ou o script falha.
- Navegador autenticado: quatro casos visíveis; detalhe de Ana exibe resposta objetiva, texto fictício e formulário de recomendação; não foi submetido. Capturas `queue.png` e `detail.png`.
- Idempotência: não cria novas tentativas nem reabre caso revisado; não muda senha de conta existente. Usuário existente sem metadata correspondente é rejeitado.
- Proteção de destino: teste com API https://example.com rejeitado antes de criar cliente ou dados (`nonlocal-guard.log`). API e DB exigem hostname local.
- `node --check scripts/dev-seed-teacher-entry.mjs`: passou.
- ESLint do script: passou (`lint.log`).
- `npm run verify:db`: passou; 66 migrations, seed canônico, 51 contratos SQL (`verify-db.log`). Não houve migration ou alteração de schema/RLS.
- `npm run verify:agent`: ver resultado final em `verify-agent.log`; não declarar certificação completa se qualquer etapa falhar.

Operação restrita ao banco local. Usa o teste publicado existente, assinatura sintética dev-seed e atribuições para teacher.dev@example.test. Dados de Helena/Gustavo/Sofia preexistentes não foram modificados.

Reexecutar: `node scripts/dev-seed-teacher-entry.mjs` (ambiente local configurado e psql disponível). O script não imprime chaves ou senhas.

## Resultado final do gate geral

verify:agent falhou no typecheck por erros sintáticos em `.next/dev/types/routes.d.ts:148–156`, reproduzindo o bloqueio já observado na tarefa do cabeçalho. Formatação e lint globais passaram (um warning preexistente em .stage12-df.config.ts). Não houve edição do arquivo gerado nem bypass. Registry permanece in_progress/verified:false; dados fictícios foram aplicados e conferidos com sucesso.
