export class NoActiveCohortError extends Error {
  constructor() {
    super("NO_ACTIVE_COHORT");
    this.name = "NoActiveCohortError";
  }
}

// The database gate raises errcode 42501 with 'active cohort membership required'. Other 42501 failures
// (RLS, role checks, subscription gate) keep their existing handling, so both signals are required.
export function isNoActiveCohortError(
  error: { code?: string | undefined; message?: string | undefined } | null | undefined,
): boolean {
  return (
    error?.code === "42501" &&
    (error.message?.toLowerCase().includes("active cohort membership required") ?? false)
  );
}

export const NO_COHORT_TITLE = "Você ainda não está em uma turma ativa.";
export const NO_COHORT_DESCRIPTION =
  "Fale com a equipe da Yas para ser alocado; seu progresso anterior foi preservado.";
