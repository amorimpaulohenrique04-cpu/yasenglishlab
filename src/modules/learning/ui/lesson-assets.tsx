import { Card } from "@/components/ui";
import type { LessonContentAsset } from "@/modules/learning/domain/models";
import { LessonVideo } from "./lesson-video";
import { ProtectedLessonAsset } from "./protected-lesson-asset";
export function LessonAssets({
  assets,
  lessonId,
  moduleTitle,
  position,
  completionPercent,
}: {
  assets: LessonContentAsset[];
  lessonId: string;
  moduleTitle: string;
  position: number | null;
  completionPercent: number;
}) {
  return assets.map((asset) => (
    <Card key={asset.id}>
      {asset.type === "VIDEO" ? (
        <LessonVideo
          assetId={asset.id}
          lessonId={lessonId}
          position={position}
          completionPercent={completionPercent}
        />
      ) : asset.type === "TEXT" ? (
        <article className="yas-learning-lesson-content">
          <div>
            <p className="yas-learning-kicker">{asset.content.eyebrow ?? moduleTitle}</p>
            <h2 className="yas-learning-card-title">{asset.content.title}</h2>
          </div>
          <p className="yas-learning-lesson-copy">{asset.content.body}</p>
          {asset.content.steps.length > 0 && (
            <ol className="yas-learning-steps">
              {asset.content.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </article>
      ) : (
        <ProtectedLessonAsset id={asset.id} type={asset.type} />
      )}
    </Card>
  ));
}
