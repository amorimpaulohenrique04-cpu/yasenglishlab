import { describe, expect, it } from "vitest";

import { promptDocumentSchema } from "@/modules/practice/domain/content-v3";

describe("practice prompt document", () => {
  it("accepts bounded structured text and marks", () => {
    expect(
      promptDocumentSchema.safeParse([
        {
          type: "paragraph",
          children: [{ text: "Read this", bold: true, italic: true, underline: true }],
        },
        { type: "bullet", children: [{ text: "One" }] },
        { type: "numbered", children: [{ text: "First" }] },
      ]).success,
    ).toBe(true);
  });

  it("rejects raw HTML and unknown fields at every level", () => {
    expect(
      promptDocumentSchema.safeParse([
        { type: "paragraph", html: "<img src=x>", children: [{ text: "safe" }] },
      ]).success,
    ).toBe(false);
    expect(
      promptDocumentSchema.safeParse([
        { type: "paragraph", children: [{ text: "safe", html: "<script>" }] },
      ]).success,
    ).toBe(false);
  });

  it("enforces block, child, and text limits", () => {
    const block = { type: "paragraph" as const, children: [{ text: "x" }] };
    expect(promptDocumentSchema.safeParse(Array.from({ length: 51 }, () => block)).success).toBe(
      false,
    );
    expect(
      promptDocumentSchema.safeParse([
        { type: "paragraph", children: Array.from({ length: 101 }, () => ({ text: "x" })) },
      ]).success,
    ).toBe(false);
    expect(
      promptDocumentSchema.safeParse([
        { type: "paragraph", children: [{ text: "x".repeat(601) }] },
      ]).success,
    ).toBe(false);
  });
});
