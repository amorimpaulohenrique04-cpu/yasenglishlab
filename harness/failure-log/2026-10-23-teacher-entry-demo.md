# 2026-10-23 — teacher-entry-demo

Status: open
Classe primária: environment

Pedido de dados executado: quatro casos REVIEW_PENDING com duas respostas, visíveis no navegador e na RPC autenticada. Seed repetido sem duplicação. verify:db, syntax e lint do script passaram.

Certificação geral pendente: verify:agent falha em `.next/dev/types/routes.d.ts:148–156` por sintaxe no arquivo gerado pelo Next. Mesmo bloqueio preexistente da tarefa teacher-practice-header. Formato/lint globais passaram. Arquivo gerado fora do escopo, não alterado; nenhuma proteção enfraquecida.

Evidência: harness/evidence/teacher-entry-demo/verify-agent.log e README.md.
