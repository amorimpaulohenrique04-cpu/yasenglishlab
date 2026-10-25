import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "yas-format-"));
const script = join(process.cwd(), "scripts/check-format.mjs");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

it("checks tracked code, preserves ignored references and ignores unrelated local files", () => {
  expect(spawnSync("git", ["init", "-q"], { cwd: dir }).status).toBe(0);
  writeFileSync(join(dir, ".gitignore"), "");
  writeFileSync(join(dir, ".prettierignore"), "reference.html\n");
  writeFileSync(join(dir, "app.js"), "const x = 1;\n");
  writeFileSync(join(dir, "local.js"), "invalid {{{");
  writeFileSync(join(dir, "reference.html"), "<main>Original</main>");
  expect(spawnSync("git", ["add", "app.js", "reference.html"], { cwd: dir }).status).toBe(0);
  const run = () => spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
  expect(run().status).toBe(0);
  writeFileSync(join(dir, "app.js"), "const x=1;\n");
  const failed = run();
  expect(failed.status).toBe(1);
  expect(failed.stderr).toContain("app.js");
});

it("skips tracked files that were deleted from the working tree", () => {
  const repo = mkdtempSync(join(tmpdir(), "yas-format-del-"));
  try {
    expect(spawnSync("git", ["init", "-q"], { cwd: repo }).status).toBe(0);
    writeFileSync(join(repo, ".gitignore"), "");
    writeFileSync(join(repo, "app.js"), "const x = 1;\n");
    writeFileSync(join(repo, "gone.js"), "const y = 2;\n");
    expect(spawnSync("git", ["add", "app.js", "gone.js"], { cwd: repo }).status).toBe(0);
    rmSync(join(repo, "gone.js"));
    const result = spawnSync(process.execPath, [script], { cwd: repo, encoding: "utf8" });
    expect(result.stderr).not.toContain("gone.js");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Formatting passed: 1 tracked");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
