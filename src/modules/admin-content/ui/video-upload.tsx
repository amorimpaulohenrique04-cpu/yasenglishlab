"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui";
const MuxUploader = dynamic(() => import("@mux/mux-uploader-react"), { ssr: false });
export function VideoUpload({
  id,
  action,
}: {
  id: string;
  action: (id: string, language: string) => Promise<{ uploadUrl: string }>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState("en");
  return (
    <div>
      <label>
        Idioma das legendas
        <select value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="en">Inglês</option>
          <option value="pt">Português</option>
          <option value="es">Espanhol</option>
        </select>
      </label>
      {!url && (
        <Button
          type="button"
          onClick={async () => {
            try {
              setUrl((await action(id, language)).uploadUrl);
              setMessage("");
            } catch {
              setMessage("Upload indisponível. Confira o estado do vídeo e tente novamente.");
            }
          }}
        >
          Preparar envio de vídeo
        </Button>
      )}
      {url && (
        <MuxUploader
          endpoint={url}
          onSuccess={() =>
            setMessage("Upload recebido. Aguarde o processamento e atualize esta página.")
          }
          onUploadError={() => setMessage("Falha no envio. Tente novamente pelo uploader.")}
        />
      )}
      <p role="status">{message}</p>
    </div>
  );
}
