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
