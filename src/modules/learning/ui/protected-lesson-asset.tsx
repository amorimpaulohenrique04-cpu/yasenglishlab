"use client";
import { useState } from "react";
import { Button, IconBadge, type IconName } from "@/components/ui";
import { lessonAssetAccessAction } from "@/app/(protected)/(student)/aulas/video-actions";

const assetVisual: Record<string, { icon: IconName; label: string }> = {
  PDF: { icon: "file", label: "Material em PDF" },
  AUDIO: { icon: "headphones", label: "Áudio da aula" },
  LINK: { icon: "globe", label: "Link complementar" },
  EXERCISE: { icon: "pen", label: "Exercício" },
};

export function ProtectedLessonAsset({ id, type }: { id: string; type: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const visual = assetVisual[type] ?? { icon: "file" as const, label: "Conteúdo da aula" };
  return (
    <div className="yas-lesson-asset">
      <IconBadge icon={visual.icon} tone={type === "PDF" ? "red" : "lilac"} shape="square" />
      <span className="yas-lesson-asset-copy">
        <strong>{visual.label}</strong>
        <small>O link de acesso é temporário e gerado na hora.</small>
      </span>
      <Button
        variant="soft"
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
        <a
          className="yas-button yas-button--secondary"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir conteúdo
        </a>
      )}
      {error && <p role="status">Conteúdo indisponível.</p>}
    </div>
  );
}
