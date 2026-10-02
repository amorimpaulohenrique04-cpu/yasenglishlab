"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { lessonAssetAccessAction } from "@/app/(protected)/(student)/aulas/video-actions";
export function ProtectedLessonAsset({ id, type }: { id: string; type: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        onClick={async () => {
          try {
            setUrl(await lessonAssetAccessAction(id));
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        Acessar conteúdo {type}
      </Button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir conteúdo
        </a>
      )}
      {error && <p role="status">Conteúdo indisponível.</p>}
    </div>
  );
}
