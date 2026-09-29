# Materials

## Propósito
Definir a biblioteca contextual para consultar, revisar e baixar recursos sem competir com Aulas ou Prática.

## Decisões
Categorias:
- PDF
- SUMMARY
- VOCABULARY
- GRAMMAR
- AUDIO
- WORKSHEET
- ANSWER_KEY

Material carrega contexto pedagógico como módulo/aula, tipo e metadata; não é apenas uma URL.
UX planejada: busca/filtros; Continue revisando; materiais por módulo; favoritos; recentes; ação contextual.
Ativos protegidos usam storage privado/signed URL conforme [SECURITY.md](./SECURITY.md).

## Invariantes
- Material conhece sua origem/contexto.
- Favoritos pertencem ao usuário.
- Conteúdo protegido respeita entitlement/autorização.
- Material não representa aula inteira nem sessão ao vivo.

## O que não fazer
- Pasta plana de PDFs sem metadata.
- URL pública permanente para conteúdo protegido.
- Duplicar progresso do curso como função central da tela.
- Colocar prática interativa em material para evitar modelar o domínio correto.

## Interfaces
[DATA_MODEL.md](./DATA_MODEL.md) · [SECURITY.md](./SECURITY.md) · [UI_CONTRACT.md](./UI_CONTRACT.md) · [PRACTICE_ENGINE.md](./PRACTICE_ENGINE.md)

## Critérios de aceitação
- Material é encontrável por contexto/tipo.
- Recurso protegido exige autorização.
- Relação com aula/módulo é preservada.
