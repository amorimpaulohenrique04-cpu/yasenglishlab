# Disponibilidade — proteção de campos incompletos

Classe: test gap.

Reprodução controlada: TimeField emite string vazia ao apagar seu conteúdo. O primeiro helper de prévia tentava converter essa string em ISO e lançava RangeError, interrompendo a edição.

Proteção: availabilityOccurrences retorna [] enquanto data/hora não estiverem válidas; o formulário mantém o conteúdo e desabilita a confirmação. Chips de dia também aceitam data temporariamente vazia usando hoje como base.

Evidência vermelha: teste keeps the preview safe while a time field is being cleared falhou com RangeError em 2026-10-23. Após a correção, os 5 testes focados passaram. Proteção permanente: tests/unit/availability-workspace.test.ts.

Autorização: o smoke inicialmente presumiu que todo SELECT de disponibilidade era privado. A leitura legada de intervalos ativos é autenticada e compartilhada por contrato. Essa leitura foi preservada; somente o novo estado pausado recebeu proteção adicional na migration 20261023202030. O smoke agora verifica as fronteiras corretas e passou com rollback.
