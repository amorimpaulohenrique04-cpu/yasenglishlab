import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/lib/constants";

describe("engineering foundation", () => {
  it("resolves the configured source alias", () => {
    expect(APP_NAME).toBe("Yas English Lab");
  });
});
