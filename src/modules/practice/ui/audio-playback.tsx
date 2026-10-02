"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
export function AudioPlayback({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="outline"
        type="button"
        onClick={async () => {
          try {
            setUrl(await action(id));
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        Carregar áudio
      </Button>
      {url && (
        <audio
          controls
          src={url}
          aria-label="Resposta de áudio"
          onError={() => {
            setUrl(null);
            setError(true);
          }}
        />
      )}
      {error && <p role="status">Áudio indisponível. Tente carregar novamente.</p>}
    </div>
  );
}
