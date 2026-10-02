# Relatório de encerramento — P21.4–P21.6

Execução encerrada a pedido do usuário para preservar créditos. **Implementação parcial, em revisão; não concluída nem verificada integralmente.** Registry permanece `in_progress`, `verified:false`.

## Base comprovada

Branch `feat/p21-p1-core-experience` criada da `origin/main` atualizada em `78c4c689b6fbabde56083b417e7bbbfc9e302ccb`, com ancestralidade obrigatória comprovada antes de implementar. Nenhuma migration histórica foi editada.

## Código entregue

- P21.4: commands de disponibilidade/sessões com Teacher derivado da autenticação, AAL2 e escopo; alvo de Private; grants sem meeting metadata; Join autorizado com cinco estados; notificações transacionais versionadas; Agenda com Join/recursos; navegação e home orientada a próximos encontros.
- P21.5: filas/revisão manual com rubric v1 e projeção sem score; MANUAL_AUDIO; reserva/upload privado/validação/playback; notas internas; recursos/homework de sessões; páginas de turmas/alunos/revisões. Migrations e testes SQL adicionados.
- P21.6: port e adapter Mux server-only, dependências oficiais fixadas; VIDEO draft/Direct Upload/READY; ledger e webhook com assinatura oficial e idempotência; tokens separados; assets ordenados; player sob demanda e checkpoints no LessonProgress; ADRs e contrato operacional.

Essas superfícies não equivalem à conclusão dos três loops. O transport fake local foi preparado em `tests/helpers/start-core-e2e-server.mjs`, mas não foi exercitado em E2E. A ferramenta ffmpeg-static foi instalada temporariamente em node_modules; nenhum fixture de vídeo foi gerado e ela não foi adicionada ao package.json/lockfile.

## Resultados observados

| Verificação                    | Resultado observado                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Primeiro replay Supabase local | PASS, todas as migrations aplicadas                                                                            |
| Segundo replay Supabase local  | PASS, todas as migrations aplicadas                                                                            |
| SQL integration                | PASS, 10 arquivos + concorrência de Agenda/quota/cancelamento                                                  |
| RLS SQL                        | PASS, 6 arquivos                                                                                               |
| Concorrência nova real         | PASS: overlap, revisão idêntica/conflitante, webhook duplicado                                                 |
| Unit                           | PASS, 17 arquivos / 90 testes                                                                                  |
| Integration Vitest             | PASS, 13 arquivos / 57 testes; 1 teste opcional já existente ignorado                                          |
| Typecheck final                | PASS                                                                                                           |
| Lint final                     | PASS                                                                                                           |
| Build no verify:agent          | PASS                                                                                                           |
| verify:harness final           | PASS                                                                                                           |
| verify:security final          | PASS, checker estrutural                                                                                       |
| verify:db final                | PASS, checker estrutural                                                                                       |
| verify:agent completo          | FAIL no eval:agent por docs obrigatórias ausentes do GOAL; declaração corrigida, gate completo não reexecutado |
| verify:ui / verify:full        | Não executados                                                                                                 |
| Official CI                    | Ainda sem resultado observado no encerramento                                                                  |
| Smoke Mux real                 | Não executado; sem credenciais/evidência real registradas                                                      |

Os replays/SQL precedem o último endurecimento do tamanho ausente na metadata de áudio. Esse pequeno ajuste final, as alterações finais de UI/captions e o bootstrap sintético de CI ainda precisam de replay/regressão correspondente. A suíte estrutural não substitui autorização pela Data API real.

## Pendências para retomada

1. Completar E2E dos três loops com Auth/PostgreSQL/Storage reais e provider fake, incluindo gravação/prévia/upload/playback, rebooking, feedback, upload Mux e retomada após logout/login. Gerar fixture local de vídeo e testar o transport fake já preparado.
2. Provar upgrade da base obrigatória com dados legados, especialmente Private sem destinatário, preservação de snapshots e conteúdo VIDEO histórico. Reexecutar SQL/replays após o ajuste final de metadata.
3. Completar matriz Data API direta, roles extras, todos os estados AAL/ownership/Cohort, revogação, campos protegidos, MIME/tamanho inválidos, overwrite, rubric inválida, tokens expirados e correlação/eventos fora de ordem.
4. Acrescentar concorrência de edição versus booking e disponibilidade versus criação/remoção; ampliar a prova de webhook/review. As provas existentes passaram, mas não cobrem todos os cenários solicitados.
5. Revisar teclado, captions, erros, desktop/tablet/mobile e screenshots; completar uso dos primitives aprovados em todos os formulários. Nenhum golden foi atualizado.
6. Completar spans/telemetria minimizada para áudio/review/video/webhook e contextos pedagógicos das páginas; revisar lifecycle de retry após erro de ingest, reconciliação do ledger PENDING e metadata de captions/thumbnail.
7. Registrar proteção permanente com prova red/green para falhas repetíveis resolvidas (ratchet). A nova concorrência já tem teste permanente, mas o registro de incidente ainda precisa ser completado.
8. Executar `verify:agent`, `verify:security`, `verify:db`, `verify:ui`, `verify:full` na versão final e inspecionar Official CI. Resolver falhas sem enfraquecer gates nem atualizar goldens cegamente.
9. Realizar/documentar smoke Mux real com credenciais não produtivas. Ausência dessa prova deve continuar explícita.

Não há autorização de merge automático. O material deve ser tratado como draft até a conclusão dessas etapas.
