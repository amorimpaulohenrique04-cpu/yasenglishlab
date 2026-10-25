export type PracticeSaveResult =
  | { status: "saved"; id: string; updatedAt: string }
  | { status: "conflict"; id: string; updatedAt: string }
  | { status: "invalid" | "unavailable"; message: string };
