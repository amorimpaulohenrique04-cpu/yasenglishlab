"use client";

import { useEffect, useRef, useState } from "react";

import { Alert, Button, Input, ProgressBar } from "@/components/ui";

import styles from "./teacher-operations.module.css";
import {
  assetAcceptAttribute,
  checkAssetFile,
  formatBytes,
  type AssetKind,
} from "./practice-builder-logic";

export interface ReserveResult {
  assetId: string;
  uploadUrl: string;
  maxBytes: number;
}

export interface StimulusAssetFieldProps {
  kind: AssetKind;
  practiceId: string | null;
  assetId: string;
  assetReady: boolean;
  disabled: boolean;
  reserve: (id: string, kind: AssetKind, mime: string) => Promise<ReserveResult>;
  complete: (assetId: string, practiceId: string) => Promise<unknown>;
  onUploaded: (assetId: string, localUrl: string) => void;
}

const KIND_COPY: Record<AssetKind, { label: string; hint: string }> = {
  IMAGE: { label: "Arquivo de imagem", hint: "PNG, JPEG ou WebP." },
  AUDIO: { label: "Arquivo de áudio", hint: "WebM, OGG, MP3, MP4 ou WAV." },
  VIDEO: { label: "Arquivo de vídeo", hint: "MP4 ou WebM." },
};

/** PUT with progress (fetch cannot report upload progress). Resolves on 2xx. */
function putWithProgress(
  url: string,
  file: File,
  mime: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", mime);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("upload"));
    request.onerror = () => reject(new Error("upload"));
    request.send(file);
  });
}

type Status = "idle" | "uploading" | "done" | "error";

export function StimulusAssetField({
  kind,
  practiceId,
  assetId,
  assetReady,
  disabled,
  reserve,
  complete,
  onUploaded,
}: StimulusAssetFieldProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  const copy = KIND_COPY[kind];

  useEffect(() => {
    // Object URLs back the live preview of an upload; they are released with the field.
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function choose(next: File | null) {
    setStatus("idle");
    setMessage(null);
    setProgress(0);
    if (!next) {
      setFile(null);
      setFileError(null);
      return;
    }
    const check = checkAssetFile(kind, next, null);
    setFile(check.ok ? next : null);
    setFileError(check.ok ? null : check.message);
  }

  async function send() {
    if (!file || !practiceId) return;
    const mime = file.type.split(";")[0] ?? "";
    setStatus("uploading");
    setMessage(null);
    setProgress(0);
    try {
      const reserved = await reserve(practiceId, kind, mime);
      const sized = checkAssetFile(kind, file, reserved.maxBytes);
      if (!sized.ok) {
        setStatus("error");
        setMessage(sized.message);
        return;
      }
      await putWithProgress(reserved.uploadUrl, file, mime, setProgress);
      await complete(reserved.assetId, practiceId);
      const localUrl = URL.createObjectURL(file);
      urls.current.push(localUrl);
      setProgress(100);
      setStatus("done");
      onUploaded(reserved.assetId, localUrl);
    } catch {
      setStatus("error");
      setMessage("Não foi possível enviar o arquivo. Confira a conexão e tente de novo.");
    }
  }

  const busy = status === "uploading";
  return (
    <div className={styles.builderStack}>
      {!practiceId && (
        <Alert
          tone="info"
          title="Salve o rascunho antes de enviar o arquivo"
          description="Preencha o título e o curso em Dados da prática e use Salvar rascunho. Depois volte aqui para enviar a mídia."
        />
      )}
      <Input
        type="file"
        label={copy.label}
        accept={assetAcceptAttribute(kind)}
        disabled={disabled || busy || !practiceId}
        message={fileError ?? copy.hint}
        tone={fileError ? "error" : "default"}
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />
      {file && (
        <p>
          Selecionado: {file.name} ({formatBytes(file.size)})
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        loading={busy}
        disabled={disabled || !file || !practiceId}
        onClick={send}
      >
        Enviar arquivo
      </Button>
      {busy && <ProgressBar value={progress} label="Enviando arquivo" />}
      {status === "error" && message && <Alert tone="error" title={message} />}
      {status === "done" && (
        <Alert
          tone="success"
          title="Arquivo enviado"
          description="Use Salvar rascunho para vincular o arquivo à prática."
        />
      )}
      {status !== "done" && assetId && (
        <p>
          {assetReady
            ? "Há um arquivo pronto vinculado a esta prática."
            : "O arquivo vinculado ainda não está pronto: envie de novo."}
        </p>
      )}
    </div>
  );
}
