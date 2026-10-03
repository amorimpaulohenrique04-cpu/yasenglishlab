import type { VideoProviderPort } from "../../src/modules/learning/application/video-provider";
import { playbackTtl } from "../../src/modules/learning/application/video-provider";
// Only tests instantiate this adapter. It never calls external services.
export class FakeVideoProvider implements VideoProviderPort {
  uploads = new Map<string, { uploadId: string; uploadUrl: string }>();
  async createDirectUpload(input: { videoId: string; origin: string; captionLanguage: string }) {
    const result = {
      uploadId: `test-${input.videoId}`,
      uploadUrl: `${input.origin}/test-upload/${input.videoId}`,
    };
    this.uploads.set(input.videoId, result);
    return result;
  }
  async signPlayback(input: { playbackId: string; durationSeconds: number }) {
    return {
      playbackId: input.playbackId,
      tokens: {
        playback: "test-video-token",
        thumbnail: "test-thumbnail-token",
        storyboard: "test-storyboard-token",
      },
      expiresAt: Date.now() + playbackTtl(input.durationSeconds) * 1000,
    };
  }
}
