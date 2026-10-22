"use client";
import { useActionState, useMemo, useReducer, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Icon,
  IconButton,
  Input,
  Select,
} from "@/components/ui";
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
    <form action={formAction} className="yas-editor-layout">
      <input type="hidden" name="cohortId" value={detail.cohortId} />
      <input type="hidden" name="payload" value={payload} />
      <div className="yas-editor-main">
        {state.error && (
          <Alert tone="error" title="Não foi possível salvar" description={state.error} />
        )}
        {payloadError && <Alert tone="error" title="Trilha inválida" description={payloadError} />}
        {state.saved && <Alert tone="success" title="Trilha salva" />}
        <section className="yas-form-section" aria-labelledby="path-mode-heading">
          <header>
            <h2 id="path-mode-heading">Como a turma segue o curso</h2>
            <p>Escolha entre o curso inteiro ou uma seleção própria de itens, ordem e datas.</p>
          </header>
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
            <Checkbox
              label="Copiar do curso ao salvar (substitui os itens atuais)"
              checked={copy}
              onChange={(e) => setCopy(e.target.checked)}
            />
          )}
        </section>

        {!custom && (
          <Alert
            tone="info"
            title="Trilha padrão"
            description="A turma vê o conteúdo do curso aberto a todas as turmas. Mude para Própria para escolher itens, ordem e datas."
          />
        )}

        {custom && !copy && (
          <section className="yas-form-section" aria-labelledby="path-items-heading">
            <header>
              <h2 id="path-items-heading">Itens da trilha ({draft.items.length})</h2>
              <p>A ordem abaixo é a ordem em que a turma vê o conteúdo.</p>
            </header>
            {draft.items.length === 0 && (
              <p className="yas-editor-summary-note">
                Nenhum item. A turma não verá conteúdo até que você inclua itens.
              </p>
            )}
            <ol className="yas-outline">
              {draft.items.map((item, index) => {
                const entry = catalog.get(`${item.contentKind}:${item.contentId}`);
                const key = `${item.contentKind}:${item.contentId}`;
                const unpublished =
                  entry?.publicationStatus && entry.publicationStatus !== "PUBLISHED";
                return (
                  <li key={key} className="yas-outline-item" data-kind={item.contentKind}>
                    <span className="yas-outline-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="yas-outline-main">
                      <h3 className="yas-outline-title">{title(entry)}</h3>
                      <span className="yas-outline-badges">
                        <Badge tone={item.contentKind === "modules" ? "info" : "neutral"}>
                          {kindLabels[item.contentKind]}
                        </Badge>
                        <Badge tone={unpublished ? "warning" : "success"}>
                          {unpublished ? "Não publicado" : "Publicado"}
                        </Badge>
                      </span>
                    </div>
                    <div className="yas-outline-actions">
                      <IconButton
                        label={`Subir ${title(entry)}`}
                        disabled={index === 0}
                        onClick={() => dispatch({ type: "move", index, direction: -1 })}
                      >
                        <span className="yas-outline-flip">
                          <Icon name="down" size={18} />
                        </span>
                      </IconButton>
                      <IconButton
                        label={`Descer ${title(entry)}`}
                        disabled={index === draft.items.length - 1}
                        onClick={() => dispatch({ type: "move", index, direction: 1 })}
                      >
                        <Icon name="down" size={18} />
                      </IconButton>
                      <IconButton
                        label={`Excluir ${title(entry)}`}
                        onClick={() =>
                          dispatch({
                            type: "exclude",
                            contentKind: item.contentKind,
                            contentId: item.contentId,
                          })
                        }
                      >
                        <Icon name="x" size={18} />
                      </IconButton>
                    </div>
                    {missing.has(item.contentId) && (
                      <div className="yas-outline-wide">
                        <Alert
                          tone="error"
                          title="Falta o item pai"
                          description="Inclua o módulo ou a aula a que este item pertence."
                        />
                      </div>
                    )}
                    <div className="yas-outline-wide">
                      <Input
                        label={`Liberar em (horário de Recife, America/Recife) — ${title(entry)}`}
                        type="datetime-local"
                        value={item.availableFrom}
                        onChange={(e) =>
                          dispatch({ type: "release", index, value: e.target.value })
                        }
                        message="Opcional. Vazio libera imediatamente."
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {custom && !copy && (
          <section className="yas-form-section" aria-labelledby="path-available-heading">
            <header>
              <h2 id="path-available-heading">Itens do curso disponíveis ({available.length})</h2>
              <p>Itens do curso que ainda não estão na trilha desta turma.</p>
            </header>
            {available.length === 0 && (
              <p className="yas-editor-summary-note">Todos os itens do curso já estão na trilha.</p>
            )}
            <ul className="yas-outline">
              {available.map((entry) => (
                <li
                  key={`${entry.contentKind}:${entry.contentId}`}
                  className="yas-outline-item"
                  data-kind={entry.contentKind}
                >
                  <span className="yas-outline-number" aria-hidden="true">
                    <Icon name="plus" size={16} />
                  </span>
                  <div className="yas-outline-main">
                    <span className="yas-outline-title">{entry.title}</span>
                    <span className="yas-outline-badges">
                      <Badge tone="neutral">{kindLabels[entry.contentKind]}</Badge>
                      {entry.audience === "COHORTS" && <Badge tone="info">Só turmas</Badge>}
                    </span>
                  </div>
                  <div className="yas-outline-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="yas-editor-aside" aria-label="Resumo da trilha">
        <Card className="yas-editor-summary">
          <h2>Resumo</h2>
          <div>
            <Badge tone={custom ? "info" : "neutral"}>
              {custom ? "Trilha própria" : "Trilha padrão"}
            </Badge>
          </div>
          {custom && !copy && (
            <p className="yas-editor-summary-count">
              <strong>{draft.items.length}</strong> {draft.items.length === 1 ? "item" : "itens"}
            </p>
          )}
          <ul className="yas-editor-summary-skills" aria-label="Regras da trilha">
            <li>
              <span>Ordem</span>
              <strong>{draft.sequential ? "Sequencial" : "Livre"}</strong>
            </li>
            <li>
              <span>Conteúdo</span>
              <strong>{custom ? "Seleção própria" : "Curso inteiro"}</strong>
            </li>
          </ul>
          <Button type="submit" loading={pending} disabled={!!payloadError}>
            Salvar trilha
          </Button>
        </Card>
      </aside>
    </form>
  );
}
