"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button, Icon } from "@/components/ui";

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Resposta falada em três passos: gravar (ou escolher um arquivo), enviar o áudio e enviar a
 * resposta para revisão. Rótulos e o único `role="status"` são contrato dos testes E2E/a11y.
 */
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
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const previewUrl = useRef<string | null>(null);
  const hiddenMedia = useRef<HTMLInputElement>(null);
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
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
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
      setElapsed(0);
      setRecording(true);
      setMessage("");
    } catch {
      setMessage("Gravação indisponível. Você pode selecionar um arquivo de áudio.");
    }
  }
  async function send() {
    if (!file || file.size > 25 * 1024 * 1024 || file.size === 0) {
      setMessage("Selecione um áudio de até 25 MiB.");
      return null;
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
      return result.mediaId;
    } catch {
      setMessage("Não foi possível enviar o áudio. Tente novamente.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Uma ação só: envia o áudio (se ainda não foi) e já submete a resposta para revisão. */
  async function sendForReview(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const id = mediaId || (await send());
    if (!id || !form || !hiddenMedia.current) return;
    hiddenMedia.current.value = id;
    setMessage("Enviando sua resposta…");
    form.requestSubmit();
  }

  const step = busy || mediaId ? 3 : file ? 2 : 1;
  const state = recording ? "recording" : mediaId ? "sent" : file ? "ready" : "idle";
  const steps = ["Grave ou escolha", "Ouça e confira", "Envie para revisão"];

  return (
    <div className="yas-practice-recorder" data-state={state}>
      <ol className="yas-practice-steps" aria-label="Etapas da resposta falada">
        {steps.map((label, index) => (
          <li
            key={label}
            data-done={index + 1 < step || undefined}
            aria-current={index + 1 === step ? "step" : undefined}
          >
            <span aria-hidden="true">
              {index + 1 < step ? <Icon name="check" size={13} strokeWidth={3} /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="yas-practice-recorder-stage">
        <Button
          type="button"
          variant="ghost"
          className="yas-practice-mic"
          aria-pressed={recording}
          disabled={busy}
          onClick={recording ? () => recorder.current?.stop() : record}
        >
          <span className="yas-practice-mic-disc" aria-hidden="true">
            <Icon name={recording ? "x" : "mic"} size={30} />
          </span>
          <span className="yas-practice-mic-label">
            {recording ? "Parar gravação" : "Gravar áudio"}
          </span>
        </Button>
        <p className="yas-practice-recorder-time" aria-hidden="true">
          {recording ? (
            <>
              <span className="yas-practice-rec-dot" />
              Gravando · {clock(elapsed)}
            </>
          ) : file ? (
            "Gravação pronta. Ouça antes de enviar."
          ) : (
            "Toque no microfone e fale com calma."
          )}
        </p>
        {preview && (
          <audio
            className="yas-practice-recorder-preview"
            controls
            src={preview}
            aria-label="Prévia da sua resposta"
          />
        )}
        {/* Com o áudio pronto, as duas ações ficam no próprio palco, lado a lado. */}
        {file && !recording && (
          <div className="yas-practice-recorder-actions">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              leadingIcon={<Icon name="redo" size={18} />}
              onClick={() => {
                selectFile(null);
                setMessage("");
              }}
            >
              Regravar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={busy}
              leadingIcon={<Icon name="check" size={18} strokeWidth={2.6} />}
              onClick={sendForReview}
            >
              Enviar para revisão
            </Button>
          </div>
        )}
      </div>

      {!file && (
        <div className="yas-practice-recorder-alt">
          <span>ou</span>
          <label className="yas-practice-file">
            <Icon name="file" size={18} />
            <span>Arquivo de áudio (até 25 MiB)</span>
            <input
              type="file"
              accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
              disabled={busy || recording}
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}

      <input ref={hiddenMedia} type="hidden" name="mediaId" value={mediaId} readOnly />
      <p className="yas-practice-recorder-message" role="status">
        {message}
      </p>
    </div>
  );
}
