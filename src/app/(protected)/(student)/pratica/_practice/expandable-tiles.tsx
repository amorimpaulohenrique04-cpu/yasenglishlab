"use client";

import { useId, useState, type ReactNode } from "react";

import { Button, Icon } from "@/components/ui";

/**
 * Lista de atividades da aula em destaque. No celular só as 3 primeiras aparecem (as demais têm
 * `data-extra`) e um controle expande o resto; no desktop o CSS ignora o recolhimento.
 */
export function ExpandableTiles({
  children,
  extraCount,
}: {
  children: ReactNode;
  extraCount: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <ul className="yas-practice-tiles" id={id} data-collapsed={!open || undefined}>
        {children}
      </ul>
      {extraCount > 0 && (
        <div className="yas-practice-tiles-more">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls={id}
            trailingIcon={<Icon name="down" size={16} />}
            onClick={() => setOpen((value) => !value)}
          >
            {open
              ? "Mostrar menos"
              : `Ver mais ${extraCount} ${extraCount === 1 ? "atividade" : "atividades"}`}
          </Button>
        </div>
      )}
    </>
  );
}
