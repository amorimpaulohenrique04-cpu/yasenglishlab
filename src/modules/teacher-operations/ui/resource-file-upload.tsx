"use client";
import { useId, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import styles from "./sessions.module.css";

const ACCEPT = "application/pdf,text/plain,audio/mpeg,audio/mp4";
const MAX_BYTES = 26214400;

const sizeLabel = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** PUT through XHR so the signed upload can report real progress. */
function putWithProgress(url: string, file: File, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error("upload")));
    request.onerror = () => reject(new Error("upload"));
    request.send(file);
  });
}

export function ResourceFileUpload({
  sessionId,
  upload,
  complete,
  onUploaded,
}: {
  sessionId: string;
  upload: (id: string, title: string) => Promise<{ resourceId: string; uploadUrl: string }>;
  complete: (id: string) => Promise<void>;
  onUploaded?: () => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const busy = progress !== null;

  const choose = (next: File | null) => {
    setMessage("");
    if (next && (next.size === 0 || next.size > MAX_BYTES)) {
      setFile(null);
      setMessage("Arquivo inválido. Use PDF, texto ou áudio de até 25 MiB.");
      return;
    }
    setFile(next);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) choose(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className={styles.upload}>
      <label
        htmlFor={inputId}
        className={styles.dropzone}
        data-dragging={dragging || undefined}
        data-filled={file ? true : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.dropIcon} aria-hidden="true">
          <Icon name={file ? "file" : "upload"} size={22} />
        </span>
        <span>
          <strong>{file ? file.name : "Arraste um arquivo ou clique para escolher"}</strong>
          <small>
            {file ? sizeLabel(file.size) : "Arquivo privado: PDF, texto ou áudio até 25 MiB"}
          </small>
        </span>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          disabled={busy}
          aria-label="Arquivo privado (PDF, texto ou áudio até 25 MiB)"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </label>
      {busy && (
        <div
          className={styles.uploadBar}
          role="progressbar"
          aria-label="Envio do arquivo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      <Button
        variant="outline"
        disabled={!file || busy}
        loading={busy}
        leadingIcon={<Icon name="upload" size={16} />}
        onClick={async () => {
          if (!file) return;
          setProgress(0);
          setMessage("");
          try {
            const result = await upload(sessionId, file.name);
            await putWithProgress(result.uploadUrl, file, setProgress);
            await complete(result.resourceId);
            setMessage("Arquivo enviado com sucesso.");
            setFile(null);
            router.refresh();
            onUploaded?.();
          } catch {
            setMessage("Falha no envio. Tente novamente.");
          } finally {
            setProgress(null);
          }
        }}
      >
        Enviar arquivo privado
      </Button>
      <p role="status" className={styles.fieldHint}>
        {message}
      </p>
    </div>
  );
}
