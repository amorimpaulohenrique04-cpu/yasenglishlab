"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
export function ResourceAccess({
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
        onClick={async () => {
          try {
            setUrl(await action(id));
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        Acessar recurso
      </Button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir recurso
        </a>
      )}
      {error && <p role="status">Sem arquivo ou acesso indisponível; confira as instruções.</p>}
    </div>
  );
}
