import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { spawnNpmSync } from "./_npm-cli.mjs";

/** Always inspect a fresh report, including when Playwright itself fails. */
export function runPlaywrightSuite(script, report, env = process.env) {
  rmSync(report, { force: true });
  const started = Date.now();
  const suite = spawnNpmSync(["run", script], { env, stdio: "inherit" });
  const gate = spawnSync(
    process.execPath,
    ["scripts/ci/check-playwright-results.mjs", report, script],
    { env: { ...env, YAS_ALLOW_FLAKY: "0", YAS_ALLOW_SKIPPED: "0" }, stdio: "inherit" },
  );
  console.log(`${script}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  if (suite.status !== 0 || gate.status !== 0) {
    throw new Error(`${script} failed (suite=${suite.status}, report=${gate.status}).`);
  }
}
