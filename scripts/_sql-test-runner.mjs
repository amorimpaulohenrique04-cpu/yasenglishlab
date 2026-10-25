import { spawnSync } from "node:child_process";

const concurrencyScripts = [
  "scripts/test-schedule-concurrency.mjs",
  "scripts/test-core-experience-concurrency.mjs",
  "scripts/test-placement-concurrency.mjs",
  "scripts/test-notification-delivery-concurrency.mjs",
  "scripts/test-billing-webhook-concurrency.mjs",
  "scripts/test-course-completion-concurrency.mjs",
];

/** Run every independent case while retaining a failing final suite result. */
export function runSqlSuite(suite, files, options = {}) {
  const spawn = options.spawn ?? spawnSync;
  const log = options.log ?? console.log;
  const error = options.error ?? console.error;
  const env = options.env ?? process.env;
  const execPath = options.execPath ?? process.execPath;
  const psqlArgs = env.DATABASE_URL ? [`--dbname=${env.DATABASE_URL}`] : [];
  psqlArgs.push("-v", "ON_ERROR_STOP=1");
  const cases = files.map((file) => ({
    name: file,
    command: "psql",
    args: [...psqlArgs, "-f", file],
  }));
  if (suite === "integration") {
    cases.push(
      ...concurrencyScripts.map((script) => ({ name: script, command: execPath, args: [script] })),
    );
  }

  const results = [];
  let missingPsql = false;
  for (const item of cases) {
    // Log case names only: arguments can contain DATABASE_URL credentials.
    log(`\n▶ ${item.name}`);
    const result = spawn(item.command, item.args, { stdio: "inherit", env });
    const exitCode = result.error ? 1 : (result.status ?? 1);
    results.push({ name: item.name, exitCode });
    log(`${exitCode === 0 ? "PASS" : "FAIL"} ${item.name} (exit ${exitCode})`);
    if (item.command === "psql" && result.error?.code === "ENOENT") {
      error("psql is required for executable database/RLS tests.");
      missingPsql = true;
      break;
    }
  }
  const failures = results.filter((result) => result.exitCode !== 0);
  if (failures.length) {
    error(`\n✗ ${suite} SQL suite failed: ${failures.map((result) => result.name).join(", ")}.`);
  } else {
    log(
      `\n✓ ${suite} SQL suite passed (${files.length} file(s), ${results.length - files.length} concurrency case(s)).`,
    );
  }
  return { results, exitCode: missingPsql ? 2 : failures.length ? 1 : 0 };
}
