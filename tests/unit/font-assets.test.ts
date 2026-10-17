import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("self-hosted product typography", () => {
  it("keeps the approved WOFF2 bytes available without a Google Fonts build fetch", () => {
    const css = readFileSync("src/app/fonts.css", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const manifest = JSON.parse(readFileSync("public/fonts/manifest.json", "utf8")) as {
      file: string;
      sha256: string;
    }[];
    expect(manifest).toHaveLength(12);
    for (const { file, sha256 } of manifest) {
      const bytes = readFileSync(`public/fonts/${file}`);
      expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
      expect(css).toContain(`/fonts/${file}`);
    }
    expect(layout).not.toContain("next/font/google");
    expect(css).not.toMatch(/https?:\/\//);
    for (const family of ["inter", "montserrat"]) {
      expect(layout).toContain(`/fonts/${family}-latin.woff2`);
      expect(css).toContain(`--yas-font-${family}`);
    }
  });
});
