"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
export function AudioResponse({
  attemptId,
  upload,
  complete,
}: {
  attemptId: string;
  upload: (id: string, mime: string) => Promise<{ mediaId: string; uploadUrl: string }>;
  complete: (id: string) => Promise<void>;
}) {
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const previewUrl = useRef<string | null>(null);
  function selectFile(next: Blob | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewUrl.current);
    setFile(next);
    setMediaId("");
  }
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  async function record() {
    try {
      const type = ["audio/webm", "audio/ogg", "audio/mp4"].find((value) =>
        MediaRecorder.isTypeSupported(value),
      );
      if (!type) throw new Error();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const next = new MediaRecorder(stream.current, { mimeType: type });
      next.ondataavailable = (event) => chunks.push(event.data);
      next.onstop = () => {
        selectFile(new Blob(chunks, { type }));
        setRecording(false);
        stream.current?.getTracks().forEach((track) => track.stop());
      };
      recorder.current = next;
      next.start();
      setRecording(true);
      setMessage("");
    } catch {
      setMessage("Gravação indisponível. Você pode selecionar um arquivo de áudio.");
    }
  }
  async function send() {
    if (!file || file.size > 25 * 1024 * 1024 || file.size === 0) {
      setMessage("Selecione um áudio de até 25 MiB.");
      return;
    }
    setBusy(true);
    setMediaId("");
    try {
      const mime = file.type.split(";")[0] ?? "";
      const result = await upload(attemptId, mime);
      const response = await fetch(result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!response.ok) throw new Error();
      await complete(result.mediaId);
      setMediaId(result.mediaId);
      setMessage("Áudio enviado. Agora envie sua resposta para revisão.");
    } catch {
      setMessage("Não foi possível enviar o áudio. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        Arquivo de áudio (até 25 MiB)
        <input
          type="file"
          accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
          disabled={busy || recording}
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={recording ? () => recorder.current?.stop() : record}
      >
        {recording ? "Parar gravação" : "Gravar áudio"}
      </Button>
      {preview && <audio controls src={preview} aria-label="Prévia da sua resposta" />}
      <Button type="button" disabled={!file || busy || recording} onClick={send}>
        {busy ? "Enviando…" : "Enviar áudio"}
      </Button>
      <input type="hidden" name="mediaId" value={mediaId} />
      <p role="status">{message}</p>
      <Button type="submit" disabled={!mediaId || busy || recording}>
        Enviar resposta para revisão
      </Button>
    </div>
  );
}
