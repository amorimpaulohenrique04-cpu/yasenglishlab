# Gabarito nulo em resposta manual — teacher-entry-redesign

Classe: test gap

Reprodução: abrir detalhe de Entry Demo com MANUAL_TEXT após ampliar a projeção; SQL retorna answerKey:null. O parser inicial aceitava apenas record/undefined e o navegador caiu em Avaliação indisponível com ZodError em responses[1].answerKey.

Causa: contrato de leitura mais restrito que a coluna nullable existente.

Correção: entryEvidenceResponseSchema aceita nullish. Loader reutiliza o contrato.

Proteção: tests/unit/entry-workspace.test.ts, caso manual com answerKey:null. Teste focado passou; detalhe confirmado no navegador após correção. Sem alterações nos gabaritos ou no motor de score.

## Correção visual — diálogo no canto
Classe secundária: ui contract. Evidência vermelha: screenshot do usuário em 2026-10-23, modal em x=0,y=0 e seta em outra linha. Causa: reset CSS retirou margem automática nativa do dialog e ícone passado como conteúdo textual do Button. Proteção: margin:auto no primitive, apresentação confirmation e trailingIcon. Story ConfirmationDialog e teste de centralização/encaixe/Escape/foco adicionados em tests/visual/design-system.spec.ts (execução adiada por pedido do usuário). Conferência direta no browser confirmou composição corrigida; a certificação automatizada segue pendente.
