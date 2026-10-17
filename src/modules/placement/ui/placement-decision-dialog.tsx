"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

/**
 * Mandatory dialog shown on Home once the placement review is finished. It cannot be dismissed with
 * Esc, the backdrop or a close button: the only ways out are choosing a cohort or the always-open
 * support, billing and profile routes. The server also blocks pedagogic routes, so this is not the gate.
 */
export function PlacementDecisionDialog({ recommendedTitle }: { recommendedTitle: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="yas-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => event.preventDefault()}
    >
      <div className="yas-dialog-inner yas-stack">
        <h2 className="yas-dialog-title" id={titleId}>
          Sua avaliação foi concluída
        </h2>
        <p className="yas-dialog-description" id={descriptionId}>
          {recommendedTitle
            ? `A equipe recomendou a trilha ${recommendedTitle}. `
            : "A equipe preparou sua recomendação. "}
          Escolha sua turma para voltar às aulas.
        </p>
        <div className="yas-cluster">
          <Link className="yas-button yas-button--primary" href="/onboarding/placement" autoFocus>
            Escolher minha turma
          </Link>
          <Link className="yas-button yas-button--ghost" href="/support">
            Preciso de ajuda
          </Link>
        </div>
      </div>
    </dialog>
  );
}
