export interface VideoPlayback {
  playbackId: string;
  tokens: { playback: string; thumbnail: string; storyboard: string };
  expiresAt: number;
  captions?: { language: string; status: "NOT_REQUESTED" | "PROCESSING" | "READY" | "ERRORED" };
}
export interface VideoProviderPort {
  createDirectUpload(input: {
    videoId: string;
    origin: string;
    captionLanguage: string;
  }): Promise<{ uploadId: string; uploadUrl: string }>;
  signPlayback(input: { playbackId: string; durationSeconds: number }): Promise<VideoPlayback>;
}
export function playbackTtl(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error("Invalid video duration.");
  return Math.min(14400, Math.ceil(durationSeconds) + 900);
}
