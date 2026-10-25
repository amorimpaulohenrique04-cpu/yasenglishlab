"use client";

import { useId, useState, type Dispatch } from "react";
import { Icon, Input, Select, Textarea } from "@/components/ui";
import { CEFR_LEVELS, PRACTICE_SKILLS } from "@/modules/domain";
import {
  SKILL_LABELS,
  type BuilderAction,
  type BuilderState,
  type ScalarField,
} from "./practice-builder-logic";
import type { PracticeBuilderProps } from "./practice-builder";
import styles from "./practices.module.css";

export function PracticeInformationFields({
  state,
  scope,
  dispatch,
}: {
  state: BuilderState;
  scope: PracticeBuilderProps["scope"];
  dispatch: Dispatch<BuilderAction>;
}) {
  const set = (field: ScalarField, value: string) => dispatch({ type: "set", field, value });
  const modules = scope.modules.filter((m) => m.courseId === state.courseId);
  const lessons = scope.lessons.filter((l) => l.moduleId === state.moduleId);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();
  const confidenceId = useId();
  const confidenceHintId = useId();
  return (
    <div className={styles.informationFields}>
      <div className={styles.mainInformation}>
        <div className={styles.counted}>
          <Input
            label="Título"
            required
            maxLength={160}
            value={state.title}
            message={`${state.title.length}/160`}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        {state.version === 3 && (
          <div className={styles.counted}>
            <Textarea
              label="Objetivo"
              required
              rows={4}
              maxLength={200}
              value={state.objective}
              message={`${state.objective.length}/200`}
              onChange={(e) => set("objective", e.target.value)}
            />
            <p className={styles.fieldHint}>O que o aluno conseguirá fazer?</p>
          </div>
        )}
      </div>
      <div className={styles.lessonFields}>
        <Select
          label="Curso"
          required
          value={state.courseId}
          options={[
            { value: "", label: "Escolha o curso" },
            ...scope.courses.map((c) => ({ value: c.id, label: c.title })),
          ]}
          onChange={(e) => dispatch({ type: "setCourse", value: e.target.value })}
          {...(!scope.courses.length
            ? { message: "Você ainda não tem turmas ativas com curso." }
            : {})}
        />
        <Select
          label="Módulo"
          required
          value={state.moduleId}
          disabled={!modules.length}
          options={[
            { value: "", label: "Escolha o módulo" },
            ...modules.map((m) => ({ value: m.id, label: m.title })),
          ]}
          onChange={(e) => {
            set("moduleId", e.target.value);
            set("lessonId", "");
          }}
        />
        <Select
          label="Aula"
          required
          value={state.lessonId}
          disabled={!lessons.length}
          options={[
            { value: "", label: "Escolha a aula" },
            ...lessons.map((l) => ({ value: l.id, label: l.title })),
          ]}
          onChange={(e) => set("lessonId", e.target.value)}
        />
      </div>
      <div className={styles.informationOptions}>
        {state.version === 3 ? (
          <div className={styles.confidenceRow}>
            <button
              type="button"
              role="switch"
              className="yas-switch"
              aria-checked={state.askConfidence}
              aria-labelledby={confidenceId}
              aria-describedby={confidenceHintId}
              onClick={() => dispatch({ type: "setAskConfidence", value: !state.askConfidence })}
            />
            <span className={styles.confidenceText}>
              <strong id={confidenceId}>Pedir confiança do aluno</strong>
              <small id={confidenceHintId}>
                Antes de começar, o aluno indica o quanto se sente confiante sobre o tema.
              </small>
            </span>
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={styles.advancedToggle}
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          Configurações adicionais
          <Icon name="down" size={16} className={styles.advancedChevron} />
        </button>
      </div>
      {advancedOpen && (
        <div id={advancedId} className={styles.advancedFields}>
          <Select
            label="Habilidade"
            required
            value={state.skill}
            options={PRACTICE_SKILLS.map((skill) => ({ value: skill, label: SKILL_LABELS[skill] }))}
            onChange={(e) => set("skill", e.target.value)}
          />
          <Select
            label="Nível-alvo (opcional)"
            value={state.cefrTarget}
            message="Referência editorial. Não indica o nível do aluno."
            options={[
              { value: "", label: "Sem nível-alvo" },
              ...CEFR_LEVELS.map((level) => ({ value: level, label: level })),
            ]}
            onChange={(e) => set("cefrTarget", e.target.value)}
          />
          <Input
            label="Dificuldade (opcional)"
            maxLength={40}
            value={state.difficulty}
            onChange={(e) => set("difficulty", e.target.value)}
          />
          <Input
            label="Minutos estimados"
            required
            type="number"
            min={1}
            max={240}
            value={state.estimatedMinutes}
            onChange={(e) => set("estimatedMinutes", e.target.value)}
          />
          <div className={styles.advancedWide}>
            <Textarea
              label="Instruções (opcional)"
              rows={2}
              maxLength={600}
              value={state.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
