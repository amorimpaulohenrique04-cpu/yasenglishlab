import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { assert, exists, success } from "../_verify-utils.mjs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const root = lock.packages?.[""] ?? {};

assert(lock.lockfileVersion === 3, "package-lock.json must use lockfileVersion 3.");
assert(packageJson.engines?.node === ">=24.0.0 <25", "Node engine must stay on supported Node 24.");
assert(readFileSync(".nvmrc", "utf8").trim() === "24", ".nvmrc must pin Node 24.");

for (const group of ["dependencies", "devDependencies"]) {
  const declared = packageJson[group] ?? {};
  const locked = root[group] ?? {};
  for (const [name, version] of Object.entries(declared)) {
    assert(
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version),
      `Direct dependency must use an exact version: ${name}@${version}`,
    );
    assert(locked[name] === version, `Lockfile root spec differs for ${name}: ${locked[name]} != ${version}`);
  }
}

const allowedInstallScripts = new Map([
  ["node_modules/esbuild", "0.28.2"],
  ["node_modules/fsevents", "2.3.3"],
  ["node_modules/unrs-resolver", "1.12.2"],
]);

const lifecyclePackages = Object.entries(lock.packages ?? {})
  .filter(([path, metadata]) => path && metadata?.hasInstallScript)
  .map(([path, metadata]) => ({ path, version: metadata.version }));

for (const item of lifecyclePackages) {
  assert(
    allowedInstallScripts.get(item.path) === item.version,
    `Unreviewed dependency lifecycle script: ${item.path}@${item.version}`,
  );
}
for (const [path, version] of allowedInstallScripts) {
  assert(
    lifecyclePackages.some((item) => item.path === path && item.version === version),
    `Reviewed lifecycle dependency changed or disappeared: ${path}@${version}`,
  );
}

assert(exists(".github/workflows"), "Missing GitHub Actions workflows.");
const workflowFiles = readdirSync(".github/workflows")
  .filter((name) => [".yml", ".yaml"].includes(extname(name)))
  .map((name) => join(".github/workflows", name));

for (const path of workflowFiles) {
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) {
    const action = match[1];
    if (action.startsWith("./") || action.startsWith("docker://")) continue;
    assert(
      /@[0-9a-f]{40}$/i.test(action),
      `GitHub Action must be pinned to a full commit SHA: ${action} in ${path}`,
    );
  }
}

assert(
  !exists("npm-shrinkwrap.json"),
  "npm-shrinkwrap.json is not part of the Yas dependency contract; package-lock.json is authoritative.",
);

success(
  `Supply-chain contract valid: exact direct versions, ${lifecyclePackages.length} reviewed lifecycle package(s), SHA-pinned Actions.`,
);
