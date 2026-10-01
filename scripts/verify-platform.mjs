import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { npmCliInvocation } from "./_npm-cli.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateInvocation(invocation) {
  const errors = [];
  if (invocation.shell) errors.push("shell execution is forbidden for npm verification runners");
  if (/\.(?:cmd|bat)$/i.test(invocation.command)) {
    errors.push("npm verification runners must invoke npm-cli.js through Node");
  }
  if (!invocation.args[0]?.endsWith("npm-cli.js")) {
    errors.push("first argument must be npm-cli.js");
  }
  return errors;
}

const redFixture = {
  command: "C:\\Program Files\\nodejs\\npm.cmd",
  args: ["run", "verify:core"],
  shell: true,
};
assert(
  validateInvocation(redFixture).length === 3,
  "Controlled Windows red fixture was not rejected.",
);

const greenFixture = npmCliInvocation(["run", "verify:core"], {
  execPath: "C:\\Program Files\\nodejs\\node.exe",
  npmExecPath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
});
assert(
  validateInvocation(greenFixture).length === 0,
  "Shell-free Windows npm invocation was not accepted.",
);
assert(
  greenFixture.args[1] === "run" && greenFixture.args[2] === "verify:core",
  "npm arguments were not preserved.",
);

const linuxFixture = npmCliInvocation(["run", "verify:core"], {
  execPath: "/usr/bin/node",
  npmExecPath: "/usr/lib/node_modules/npm/bin/npm-cli.js",
});
assert(
  validateInvocation(linuxFixture).length === 0,
  "Shell-free Linux npm invocation was not accepted.",
);

const playwrightConfig = readFileSync("playwright.config.ts", "utf8");
assert(
  /\bworkers:\s*1\b/.test(playwrightConfig),
  "Canonical Playwright E2E must use one worker for deterministic Windows cold starts.",
);

const canonicalE2e = readFileSync("tests/e2e/canonical-slice.spec.ts", "utf8");
assert(
  canonicalE2e.includes("test.setTimeout(120_000)"),
  "The multi-viewport canonical E2E needs its explicit Windows-safe time budget.",
);

const goldenConfig = readFileSync("playwright.golden.config.ts", "utf8");
assert(
  goldenConfig.includes("{platform}"),
  "Golden screenshot paths must separate host platforms to avoid font-rasterization false positives.",
);

const scratch = mkdtempSync(join(tmpdir(), "yas runner path with spaces "));
try {
  const probe = join(scratch, "argument probe.mjs");
  writeFileSync(probe, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n", "utf8");
  const result = spawnSync(process.execPath, [probe, "value with spaces", "& literal"], {
    encoding: "utf8",
  });
  assert(result.status === 0, result.stderr || "Path-with-spaces probe failed.");
  assert(
    result.stdout === '["value with spaces","& literal"]',
    "Arguments containing spaces or shell metacharacters were changed.",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const scriptFiles = globSync("scripts/**/*.mjs")
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => path !== "scripts/verify-platform.mjs");
for (const path of scriptFiles) {
  const source = readFileSync(path, "utf8");
  assert(!source.includes("npm.cmd"), `${path} dispatches npm through npm.cmd.`);
  assert(!/\bshell\s*:/.test(source), `${path} enables child-process shell execution.`);
}

const attributes = spawnSync(
  "git",
  ["check-attr", "eol", "text", "--", "AGENTS.md", "scripts/verify-core.mjs", "package.json"],
  { encoding: "utf8" },
);
assert(attributes.status === 0, attributes.stderr || "git check-attr failed.");
const attributeLines = attributes.stdout.trim().split(/\r?\n/);
assert(
  attributeLines.filter((line) => line.endsWith("eol: lf")).length === 3,
  "Repository text files are not consistently attributed as LF.",
);
assert(
  attributeLines.filter((line) => line.endsWith("text: auto")).length === 3,
  "Repository text files are not consistently attributed as text=auto.",
);

console.log(
  `✓ Platform contract valid: red fixture rejected, shell-free Windows fixture accepted, ${scriptFiles.length} scripts audited, LF enforced.`,
);
