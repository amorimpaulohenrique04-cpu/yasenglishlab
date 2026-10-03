"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
export function ResourceFileUpload({
  sessionId,
  upload,
  complete,
}: {
  sessionId: string;
  upload: (id: string, title: string) => Promise<{ resourceId: string; uploadUrl: string }>;
  complete: (id: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label>
        Arquivo privado (PDF, texto ou áudio até 25 MiB)
        <input
          type="file"
          accept="application/pdf,text/plain,audio/mpeg,audio/mp4"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        disabled={!file || busy}
        onClick={async () => {
          if (!file || file.size > 26214400 || file.size === 0) {
            setMessage("Arquivo inválido.");
            return;
          }
          setBusy(true);
          try {
            const result = await upload(sessionId, file.name);
            const response = await fetch(result.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (!response.ok) throw new Error();
            await complete(result.resourceId);
            setMessage("Arquivo enviado. Atualize a página para vê-lo.");
          } catch {
            setMessage("Falha no envio. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Enviar arquivo privado
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}
