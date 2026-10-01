export type AdminContentErrorCode =
  | "LESSON_NEEDS_ASSET"
  | "PRACTICE_NEEDS_ANSWER_KEY"
  | "INVALID_REFERENCE"
  | "INVALID_CONTENT"
  | "UNAVAILABLE";

export class AdminContentError extends Error {
  constructor(
    readonly code: AdminContentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminContentError";
  }
}
