import { describe, expect, it } from "vitest";
import { requirePreview, requireSuccessfulGates } from "../../scripts/ci/gate-results.mjs";

describe("required CI gates", () => {
  it("accepts all successful gates", () => {
    expect(() => requireSuccessfulGates({ quality: "success", preview: "success" })).not.toThrow();
  });
  it.each(["failure", "cancelled", "skipped", undefined])(
    "rejects mandatory gate state %s",
    (state) => {
      expect(() => requireSuccessfulGates({ quality: "success", preview: state })).toThrow();
      expect(() => requirePreview("true", state)).toThrow();
    },
  );
  it("only permits the explicit documentation-only Preview exemption", () => {
    expect(() => requirePreview("false", "skipped")).not.toThrow();
    expect(() => requirePreview(undefined, "skipped")).toThrow();
    expect(() => requirePreview("false", "failure")).toThrow();
    expect(() => requirePreview("true", "success")).not.toThrow();
  });
});
