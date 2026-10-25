import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requireSuccessfulGates } from "../../scripts/ci/gate-results.mjs";

const workflow = readFileSync(".github/workflows/foundation-verify.yml", "utf8");
function step(text: string, title: string) {
  return text.split(`      - name: ${title}\n`)[1]?.split("      - name:")[0] ?? "";
}
function independent(text: string, title: string) {
  return /if:.*!cancelled\(\).*steps\.[a-z]+\.outcome == 'success'/.test(step(text, title));
}

describe("CI continues diagnostics while preserving failures", () => {
  it.each([
    "Lint",
    "Typecheck",
    "Unit tests",
    "Integration tests",
    "Harness invariants",
    "Security invariants",
    "Database structural invariants",
    "Agent behavioral eval",
    "Production build",
    "Validate migrations from a clean database",
    "Replay migrations from a second clean database",
    "Validate base-to-head upgrade with legacy data",
    "Prove RLS permissions",
    "Prove intentional error reaches observability",
    "Assert persistence and analytics",
    "Product golden visual checks",
    "Full release verification",
  ])("runs %s after an unrelated failure when its prerequisites succeeded", (title) => {
    expect(independent(workflow, title)).toBe(true);
  });

  it("detects a regression that would skip checks after a previous failure", () => {
    const red = workflow.replace(/(      - name: Lint\n)        if:.*\n/, "$1");
    expect(independent(red, "Lint")).toBe(false);
    expect(independent(workflow, "Lint")).toBe(true);
  });

  it("does not let failing prerequisite jobs suppress the independent Preview matrix", () => {
    expect(workflow).toContain("needs: supply-chain\n    if: ${{ !cancelled() }}");
    expect(workflow).toContain("if: ${{ !cancelled() && needs.changes.outputs.code != 'false' }}");
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("  push:\n    branches: [main, codex/teacher-sessions-redesign]");
    expect(workflow).not.toContain("continue-on-error: true");
    expect(() => requireSuccessfulGates({ quality: "failure", preview: "success" })).toThrow();
  });

  it("uploads only sanitized evidence even after a failed test", () => {
    expect(step(workflow, "Sanitize preview evidence")).toContain("if: always()");
    expect(step(workflow, "Upload preview evidence")).toContain(
      "steps.sanitize.outcome == 'success'",
    );
  });
});
