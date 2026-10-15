import { Alert } from "@/components/ui";

import type { PracticeStimulusV2 } from "../domain/content-v2";

function Transcript({ transcript }: { transcript: string | undefined }) {
  if (!transcript?.trim()) return null;
  return (
    <details className="yas-practice-transcript">
      <summary className="yas-focusable">Ver transcrição</summary>
      <p>{transcript}</p>
    </details>
  );
}

/**
 * Renders the stimulus of a v2 practice. `url` is a short-lived signed URL minted on the server
 * (`getPracticeStimulusUrl`); the component never builds storage paths itself.
 */
export function PracticeStimulus({
  stimulus,
  url,
}: {
  stimulus: PracticeStimulusV2;
  url?: string | null | undefined;
}) {
  if (stimulus.type === "NONE") return null;

  if (stimulus.type === "TEXT") {
    return (
      <figure className="yas-practice-stimulus" aria-label="Texto de apoio">
        <p className="yas-practice-stimulus-text">{stimulus.text}</p>
      </figure>
    );
  }

  if (!url) {
    return (
      <Alert
        tone="warning"
        title="Não foi possível carregar a mídia"
        description="Recarregue a página para tentar de novo. Se continuar, avise seu professor."
      />
    );
  }

  if (stimulus.type === "IMAGE") {
    return (
      <figure className="yas-practice-stimulus">
        {/* Signed storage URL with unknown host/size: next/image optimisation does not apply. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="yas-practice-stimulus-media" src={url} alt={stimulus.alt} />
      </figure>
    );
  }

  if (stimulus.type === "AUDIO") {
    return (
      <figure className="yas-practice-stimulus">
        <audio controls preload="metadata" src={url} aria-label="Áudio da atividade" />
        <Transcript transcript={stimulus.transcript} />
      </figure>
    );
  }

  return (
    <figure className="yas-practice-stimulus">
      <video
        className="yas-practice-stimulus-media"
        controls
        preload="metadata"
        src={url}
        aria-label="Vídeo da atividade"
      />
      <Transcript transcript={stimulus.transcript} />
    </figure>
  );
}
