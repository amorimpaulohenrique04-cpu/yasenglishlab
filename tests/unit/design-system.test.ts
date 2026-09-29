import { describe, expect, it } from "vitest";

import { yasTokens } from "@/styles/tokens";
import { clampProgress, cx } from "@/components/ui/utils";

describe("design-system utilities", () => {
  it("clamps progress to the accessible 0-100 range", () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(62)).toBe(62);
    expect(clampProgress(140)).toBe(100);
    expect(clampProgress(Number.NaN)).toBe(0);
  });

  it("composes class names without falsey fragments", () => {
    expect(cx("a", false, undefined, "b")).toBe("a b");
  });

  it("exposes every required token category", () => {
    expect(Object.keys(yasTokens)).toEqual(
      expect.arrayContaining([
        "colors",
        "typography",
        "spacing",
        "radius",
        "shadow",
        "border",
        "breakpoints",
        "zIndex",
        "motion",
      ]),
    );
  });
});
