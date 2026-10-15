import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Failure log 2026-10-15-e2e-axe-transition-flake: axe scanned a selected tab mid-transition.
describe("Playwright motion config", () => {
  it.each([
    "playwright.config.ts",
    "playwright.a11y.config.ts",
    "playwright.visual.config.ts",
    "playwright.golden.config.ts",
  ])("%s emulates reduced motion so axe never scans a transition", (file) => {
    expect(readFileSync(file, "utf8")).toMatch(/reducedMotion:\s*"reduce"/);
  });
});
