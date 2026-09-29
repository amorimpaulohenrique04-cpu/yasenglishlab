import { describe, expect, it } from "vitest";

describe("prompt 08 deliberate regression proof", () => {
  it("fails closed when a regression is introduced", () => {
    expect("regression-detected").toBe("regression-allowed");
  });
});
