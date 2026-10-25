"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PracticeSaveResult } from "../domain/practice-autosave";
import { toFormEntries, validateDraft, type BuilderState } from "./practice-builder-logic";

function fingerprint(state: BuilderState) {
  return JSON.stringify({ ...state, id: null });
}

export function usePracticeAutosave({
  state,
  disabled,
  updatedAt,
  save,
  onCreated,
}: {
  state: BuilderState;
  disabled: boolean;
  updatedAt?: string | undefined;
  save?:
    | ((
        form: FormData,
        creationKey: string,
        expected: string | null,
      ) => Promise<PracticeSaveResult>)
    | undefined;
  onCreated: (id: string) => void;
}) {
  const [savedSnapshot, setSavedSnapshot] = useState(() => fingerprint(state));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [message, setMessage] = useState("");
  const [savedAt, setSavedAt] = useState(updatedAt ?? "");
  const id = useRef(state.id);
  const revision = useRef(updatedAt ?? null);
  const creationKey = useRef<string | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  const queued = useRef<BuilderState | null>(null);
  const conflict = useRef(false);
  const dirty = fingerprint(state) !== savedSnapshot;

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!save || disabled || conflict.current) return false;
    // Nothing new to persist: an explicit save must not race another tab's newer revision.
    if (!dirty && id.current && !running.current) return true;
    if (Object.keys(validateDraft(state)).length || !state.moduleId || !state.lessonId) {
      setMessage("Preencha título, curso, módulo e aula para salvar o rascunho.");
      return false;
    }
    queued.current = state;
    if (running.current) return running.current;
    const work = async () => {
      while (queued.current) {
        const captured = queued.current;
        queued.current = null;
        const form = new FormData();
        for (const [name, value] of toFormEntries({ ...captured, id: id.current }))
          form.set(name, value);
        creationKey.current ??= crypto.randomUUID();
        setStatus("saving");
        let result: PracticeSaveResult;
        try {
          result = await save(form, creationKey.current, revision.current);
        } catch {
          result = { status: "unavailable", message: "Não foi possível salvar. Tente novamente." };
        }
        if (result.status !== "saved") {
          queued.current = null;
          conflict.current = result.status === "conflict";
          if (result.status === "conflict" && !id.current) {
            id.current = result.id;
            onCreated(result.id);
            window.history.replaceState(null, "", `/teacher/praticas/${result.id}`);
          }
          setStatus(result.status === "conflict" ? "conflict" : "error");
          setMessage(
            result.status === "conflict"
              ? "Esta prática mudou em outra aba. Recarregue para obter a versão atual antes de continuar."
              : result.message,
          );
          return false;
        }
        id.current = result.id;
        revision.current = result.updatedAt;
        setSavedAt(result.updatedAt);
        setSavedSnapshot(fingerprint(captured));
        setStatus("saved");
        setMessage("");
        if (!captured.id) {
          onCreated(result.id);
          window.history.replaceState(null, "", `/teacher/praticas/${result.id}`);
        }
      }
      return true;
    };
    running.current = work();
    try {
      return await running.current;
    } finally {
      running.current = null;
    }
  }, [state, dirty, save, disabled, onCreated]);

  useEffect(() => {
    if (
      !dirty ||
      disabled ||
      conflict.current ||
      !state.title.trim() ||
      !state.courseId ||
      !state.moduleId ||
      !state.lessonId
    )
      return;
    const timer = window.setTimeout(() => {
      void saveNow();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, disabled, state, saveNow]);

  useEffect(() => {
    if (!dirty || disabled) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        anchor instanceof HTMLAnchorElement &&
        anchor.origin === location.origin &&
        anchor.pathname !== location.pathname &&
        !window.confirm("Há alterações não salvas. Deseja sair desta prática?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, disabled]);

  return { dirty, status, message, savedAt, saveNow, practiceId: state.id };
}
