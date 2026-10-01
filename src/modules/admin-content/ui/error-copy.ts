export function adminContentErrorCopy(key: string | undefined): string | null {
  if (!key) return null;
  const messages: Record<string, string> = {
    lesson_needs_asset:
      "Para publicar uma aula, publique primeiro pelo menos um conteúdo de aula válido.",
    practice_needs_answer_key:
      "Escolha no gabarito privado uma opção que exista na atividade antes de publicar.",
    invalid_reference:
      "Confira as relações entre curso, módulo e aula, além do entitlement selecionado.",
    invalid_content:
      "Confira título, slug, ordem, URL e os campos obrigatórios deste tipo de conteúdo.",
    unavailable: "A operação não foi concluída. Atualize a lista e tente novamente.",
    invalid: "Confira os campos e as relações selecionadas antes de tentar novamente.",
  };
  return messages[key] ?? messages.unavailable!;
}
