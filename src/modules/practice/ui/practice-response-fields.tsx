"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";

import { Button, Checkbox, Icon, Radio, Textarea } from "@/components/ui";

import type { PracticeResponseV2 } from "../domain/content-v2";
import {
  WRITTEN_MAX_LENGTH,
  moveOrderItem,
  orderAnnouncement,
  splitCloze,
  toggleOption,
  type PlayerAnswerState,
} from "./practice-player-logic";

interface FieldsProps {
  response: PracticeResponseV2;
  state: PlayerAnswerState;
  onChange: (next: PlayerAnswerState) => void;
  disabled: boolean;
}

function OrderingField({
  items,
  state,
  onChange,
  disabled,
}: {
  items: { id: string; label: string }[];
  state: PlayerAnswerState;
  onChange: (next: PlayerAnswerState) => void;
  disabled: boolean;
}) {
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const pendingFocus = useRef<{ id: string; direction: "up" | "down" } | null>(null);
  const labelOf = (id: string) => items.find((item) => item.id === id)?.label ?? id;

  useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    pendingFocus.current = null;
    const find = (direction: string) =>
      Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-move]") ?? []).find(
        (button) => button.dataset.move === `${request.id}:${direction}`,
      );
    const same = find(request.direction);
    (same && !same.disabled ? same : find(request.direction === "up" ? "down" : "up"))?.focus();
  }, [state.order]);

  function move(index: number, direction: "up" | "down") {
    const id = state.order[index]!;
    const next = moveOrderItem(state.order, index, direction);
    pendingFocus.current = { id, direction };
    setAnnouncement(orderAnnouncement(labelOf(id), next.indexOf(id) + 1, next.length));
    onChange({ ...state, order: next });
  }

  return (
    <fieldset className="yas-practice-fieldset yas-practice-fieldset--ordering">
      <legend>Coloque os itens na ordem correta</legend>
      <p className="yas-practice-hint">Use as setas para subir ou descer cada item.</p>
      <ol className="yas-practice-ordering" ref={list}>
        {state.order.map((id, index) => (
          <li key={id} className="yas-practice-ordering-item">
            <span className="yas-practice-ordering-position" aria-hidden="true">
              {index + 1}
            </span>
            <span className="yas-practice-ordering-label">{labelOf(id)}</span>
            <span className="yas-practice-ordering-actions">
              <Button
                data-move={`${id}:up`}
                type="button"
                variant="soft"
                size="sm"
                className="yas-practice-ordering-move"
                disabled={disabled || index === 0}
                aria-label={`Subir: ${labelOf(id)}`}
                onClick={() => move(index, "up")}
              >
                <Icon name="down" size={16} className="yas-practice-ordering-up" />
              </Button>
              <Button
                data-move={`${id}:down`}
                type="button"
                variant="soft"
                size="sm"
                className="yas-practice-ordering-move"
                disabled={disabled || index === state.order.length - 1}
                aria-label={`Descer: ${labelOf(id)}`}
                onClick={() => move(index, "down")}
              >
                <Icon name="down" size={16} />
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <p className="yas-practice-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </fieldset>
  );
}

export function PracticeResponseFields({ response, state, onChange, disabled }: FieldsProps) {
  const name = useId();

  switch (response.type) {
    case "CHOICE_SINGLE":
      return (
        <fieldset className="yas-practice-fieldset yas-practice-options" disabled={disabled}>
          <legend>Escolha uma resposta</legend>
          {response.options.map((option) => (
            <Radio
              key={option.id}
              name={name}
              value={option.id}
              label={option.label}
              checked={state.optionId === option.id}
              onChange={() => onChange({ ...state, optionId: option.id })}
            />
          ))}
        </fieldset>
      );
    case "CHOICE_MULTI":
      return (
        <fieldset
          className="yas-practice-fieldset yas-practice-options yas-practice-options--multi"
          disabled={disabled}
        >
          <legend>Escolha uma ou mais respostas</legend>
          {response.options.map((option) => (
            <Checkbox
              key={option.id}
              name={name}
              value={option.id}
              label={option.label}
              checked={state.optionIds.includes(option.id)}
              onChange={() =>
                onChange({ ...state, optionIds: toggleOption(state.optionIds, option.id) })
              }
            />
          ))}
        </fieldset>
      );
    case "TRUE_FALSE":
      return (
        <fieldset
          className="yas-practice-fieldset yas-practice-options yas-practice-options--binary"
          disabled={disabled}
        >
          <legend>{response.statement}</legend>
          <Radio
            name={name}
            value="true"
            label="Verdadeiro"
            checked={state.value === true}
            onChange={() => onChange({ ...state, value: true })}
          />
          <Radio
            name={name}
            value="false"
            label="Falso"
            checked={state.value === false}
            onChange={() => onChange({ ...state, value: false })}
          />
        </fieldset>
      );
    case "CLOZE": {
      const segments = splitCloze(response.text);
      const numbering: string[] = [];
      for (const segment of segments) {
        if (segment.kind === "blank" && !numbering.includes(segment.id)) numbering.push(segment.id);
      }
      return (
        <fieldset
          className="yas-practice-fieldset yas-practice-fieldset--cloze"
          disabled={disabled}
        >
          <legend>Complete as lacunas</legend>
          <p className="yas-practice-cloze">
            {segments.map((segment, index) =>
              segment.kind === "text" ? (
                <Fragment key={index}>{segment.value}</Fragment>
              ) : (
                <input
                  key={index}
                  className="yas-field-control yas-practice-cloze-input"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={200}
                  aria-label={`Lacuna ${numbering.indexOf(segment.id) + 1}`}
                  value={state.blanks[segment.id] ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...state,
                      blanks: { ...state.blanks, [segment.id]: event.target.value },
                    })
                  }
                />
              ),
            )}
          </p>
        </fieldset>
      );
    }
    case "ORDERING":
      return (
        <OrderingField
          items={response.items}
          state={state}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "WRITTEN":
      return (
        <div className="yas-practice-written">
          <Textarea
            label="Sua resposta"
            rows={6}
            maxLength={WRITTEN_MAX_LENGTH}
            disabled={disabled}
            value={state.text}
            onChange={(event) => onChange({ ...state, text: event.target.value })}
            message={`${state.text.length} de ${WRITTEN_MAX_LENGTH} caracteres`}
          />
          <p className="yas-practice-hint">
            Esta resposta não tem nota automática: ela passa por revisão do professor.
          </p>
        </div>
      );
    case "SPOKEN":
      return null;
  }
}
