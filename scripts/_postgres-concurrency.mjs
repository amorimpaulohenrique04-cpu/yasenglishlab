import { spawn, spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const connectionArgs = databaseUrl ? [`--dbname=${databaseUrl}`] : [];

export function runAdmin(sql) {
  const result = spawnSync(
    "psql",
    [...connectionArgs, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql],
    {
      encoding: "utf8",
    },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error("psql is required for the Agenda concurrency test.");
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || "Unable to prepare Agenda concurrency fixture.");
  }
  return result.stdout.trim();
}

function runConcurrent(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...connectionArgs, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export async function withBarrier(lockSql, operations) {
  const barrier = spawn("psql", [...connectionArgs, "-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let barrierStderr = "";
  barrier.stderr.on("data", (chunk) => {
    barrierStderr += chunk;
  });
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    barrier.stdout.on("data", (chunk) => {
      if (!settled && chunk.toString().includes("BARRIER_READY")) {
        settled = true;
        resolve();
      }
    });
    barrier.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    barrier.on("close", (code) => {
      if (!settled) {
        settled = true;
        reject(
          new Error(
            barrierStderr.trim() || `Concurrency barrier exited before ready (code ${code}).`,
          ),
        );
      }
    });
  });
  barrier.stdin.write(`begin; ${lockSql}; select 'BARRIER_READY';\n`);
  await ready;
  const attempts = operations.map((sql) =>
    runConcurrent(`set application_name='yas-core-race'; ${sql}`),
  );
  try {
    for (let poll = 0; poll < 100; poll++) {
      const waiting = Number(
        runAdmin(
          "select count(*) from pg_stat_activity where application_name='yas-core-race' and wait_event_type='Lock'",
        ),
      );
      if (waiting === operations.length) break;
      if (poll === 99)
        throw new Error("Concurrency operations never reached the held lock barrier.");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  } finally {
    barrier.stdin.end("commit;\n");
  }
  return Promise.all(attempts);
}
