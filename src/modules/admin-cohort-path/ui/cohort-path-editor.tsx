"use client";
import { useActionState, useMemo, useReducer, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Input, Select } from "@/components/ui";
import styles from "@/modules/admin-content/ui/admin-content.module.css";
import {
  draftFromDetail,
  itemsMissingParent,
  kindLabels,
  pathReducer,
  serializeDraft,
  type CatalogEntry,
  type CohortPathDetail,
  type CohortPathFormState,
} from "../domain/models";

export function CohortPathEditor({
  detail,
  action,
}: {
  detail: CohortPathDetail;
  action: (state: CohortPathFormState, data: FormData) => Promise<CohortPathFormState>;
}) {
  const [draft, dispatch] = useReducer(pathReducer, detail, draftFromDetail);
  const [copy, setCopy] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  const catalog = useMemo(
    () => new Map(detail.catalog.map((c) => [`${c.contentKind}:${c.contentId}`, c])),
    [detail.catalog],
  );
  const included = new Set(draft.items.map((i) => `${i.contentKind}:${i.contentId}`));
  const available = detail.catalog.filter((c) => !included.has(`${c.contentKind}:${c.contentId}`));
  const missing = new Set(itemsMissingParent(draft, detail.catalog));
  const custom = draft.mode === "CUSTOM";

  let payload = "";
  let payloadError = "";
  try {
    payload = JSON.stringify(serializeDraft(draft, copy));
  } catch (error) {
    payloadError = error instanceof Error ? error.message : "Trilha inválida.";
  }

  function title(entry: CatalogEntry | undefined) {
    return entry?.title ?? "Item removido";
  }

  return (
    <form action={formAction} className={styles.editorForm}>
      <input type="hidden" name="cohortId" value={detail.cohortId} />
      <input type="hidden" name="payload" value={payload} />
      {state.error && (
        <Alert tone="error" title="Não foi possível salvar" description={state.error} />
      )}
      {payloadError && <Alert tone="error" title="Trilha inválida" description={payloadError} />}
      {state.saved && <Alert tone="success" title="Trilha salva" />}
      <Card className={styles.editorCard}>
        <Select
          label="Modo da trilha"
          value={draft.mode}
          onChange={(e) => {
            dispatch({ type: "mode", mode: e.target.value as "DEFAULT" | "CUSTOM" });
            if (e.target.value === "DEFAULT") setCopy(false);
          }}
          options={[
            { value: "DEFAULT", label: "Padrão: a turma segue o curso" },
            { value: "CUSTOM", label: "Própria: a turma segue os itens abaixo" },
          ]}
        />
        <Checkbox
          label="Sequencial: cada item só abre depois de concluir o anterior"
          checked={draft.sequential}
          onChange={(e) => dispatch({ type: "sequential", value: e.target.checked })}
        />
        {custom && (
          <div className={styles.actions}>
            <Checkbox
              label="Copiar do curso ao salvar (substitui os itens atuais)"
              checked={copy}
              onChange={(e) => setCopy(e.target.checked)}
            />
          </div>
        )}
      </Card>

      {!custom && (
        <Alert
          tone="info"
          title="Trilha padrão"
          description="A turma vê o conteúdo do curso aberto a todas as turmas. Mude para Própria para escolher itens, ordem e datas."
        />
      )}

      {custom && !copy && (
        <Card className={styles.editorCard}>
          <h2>Itens da trilha ({draft.items.length})</h2>
          {draft.items.length === 0 && (
            <p>Nenhum item. A turma não verá conteúdo até que você inclua itens.</p>
          )}
          <ol className="yas-stack">
            {draft.items.map((item, index) => {
              const entry = catalog.get(`${item.contentKind}:${item.contentId}`);
              const key = `${item.contentKind}:${item.contentId}`;
              return (
                <li key={key} className="yas-row-summary">
                  <h3>
                    {index + 1}. {title(entry)}{" "}
                    <Badge tone="neutral">{kindLabels[item.contentKind]}</Badge>
                    {entry?.publicationStatus && entry.publicationStatus !== "PUBLISHED" && (
                      <Badge tone="warning">Não publicado</Badge>
                    )}
                  </h3>
                  {missing.has(item.contentId) && (
                    <Alert
                      tone="error"
                      title="Falta o item pai"
                      description="Inclua o módulo ou a aula a que este item pertence."
                    />
                  )}
                  <Input
                    label={`Liberar em (horário de Recife, America/Recife) — ${title(entry)}`}
                    type="datetime-local"
                    value={item.availableFrom}
                    onChange={(e) => dispatch({ type: "release", index, value: e.target.value })}
                    message="Opcional. Vazio libera imediatamente."
                  />
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={index === 0}
                      aria-label={`Subir ${title(entry)}`}
                      onClick={() => dispatch({ type: "move", index, direction: -1 })}
                    >
                      Subir
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={index === draft.items.length - 1}
                      aria-label={`Descer ${title(entry)}`}
                      onClick={() => dispatch({ type: "move", index, direction: 1 })}
                    >
                      Descer
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label={`Excluir ${title(entry)}`}
                      onClick={() =>
                        dispatch({
                          type: "exclude",
                          contentKind: item.contentKind,
                          contentId: item.contentId,
                        })
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {custom && !copy && (
        <Card className={styles.editorCard}>
          <h2>Itens do curso disponíveis ({available.length})</h2>
          {available.length === 0 && <p>Todos os itens do curso já estão na trilha.</p>}
          <ul className="yas-stack">
            {available.map((entry) => (
              <li key={`${entry.contentKind}:${entry.contentId}`} className="yas-cluster">
                <span>
                  {entry.title} <Badge tone="neutral">{kindLabels[entry.contentKind]}</Badge>
                  {entry.audience === "COHORTS" && <Badge tone="info">Só turmas</Badge>}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Incluir ${entry.title}`}
                  onClick={() =>
                    dispatch({
                      type: "include",
                      entry: { contentKind: entry.contentKind, contentId: entry.contentId },
                    })
                  }
                >
                  Incluir
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className={styles.actions}>
        <Button type="submit" loading={pending} disabled={!!payloadError}>
          Salvar trilha
        </Button>
      </div>
    </form>
  );
}
