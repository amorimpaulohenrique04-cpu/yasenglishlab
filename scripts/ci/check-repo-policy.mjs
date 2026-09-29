import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const nvmrc = readFileSync(".nvmrc", "utf8").trim();

if (lock.lockfileVersion !== 3) {
  fail(`package-lock.json must use lockfileVersion 3, got ${lock.lockfileVersion}`);
}

const lockRoot = lock.packages?.[""];
if (!lockRoot) {
  fail("package-lock.json has no root package entry.");
} else {
  for (const section of ["dependencies", "devDependencies"]) {
    const manifest = pkg[section] ?? {};
    const lockedManifest = lockRoot[section] ?? {};
    if (JSON.stringify(manifest) !== JSON.stringify(lockedManifest)) {
      fail(
        `package.json and package-lock.json disagree in ${section}. Run npm install and commit the lockfile.`,
      );
    }
  }
}

if (nvmrc !== "24") {
  fail(`.nvmrc must pin Node major 24, got "${nvmrc}".`);
}

const engine = pkg.engines?.node ?? "";
if (!engine.includes(">=24") || !engine.includes("<25")) {
  fail(`package.json engines.node must constrain Node to 24.x, got "${engine}".`);
}

for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
  if (pkg.scripts?.[script]) {
    fail(`Root lifecycle script "${script}" is not allowed without an explicit security review.`);
  }
}

const suspiciousScriptPattern =
  /(?:curl|wget|invoke-webrequest|certutil|bitsadmin|powershell\s+-enc|bash\s+-c|sh\s+-c).*(?:https?:\/\/|base64|eval)/i;

for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  if (suspiciousScriptPattern.test(command)) {
    fail(`Suspicious root npm script "${name}": ${command}`);
  }
}

const workflowDir = ".github/workflows";
for (const entry of readdirSync(workflowDir)) {
  if (!/\.ya?ml$/.test(entry)) continue;
  const path = join(workflowDir, entry);
  if (!statSync(path).isFile()) continue;
  const content = readFileSync(path, "utf8");

  for (const match of content.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)) {
    const ref = match[1];
    if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
    if (!/^[^@]+@[0-9a-f]{40}$/.test(ref)) {
      fail(`GitHub Action must be pinned to a full commit SHA: ${path}: ${ref}`);
    }
  }
}

if (!process.exitCode) {
  console.log(
    "✓ repository policy passed: lockfile, Node version, scripts and pinned Actions are valid.",
  );
}
