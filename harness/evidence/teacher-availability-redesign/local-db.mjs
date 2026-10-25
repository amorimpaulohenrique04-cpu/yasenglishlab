// Applies only this task's additive migration to localhost, never resets a database.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
const db = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(db.hostname))
  throw new Error("Localhost required");
const env = {
  ...process.env,
  PGHOST: db.hostname,
  PGPORT: db.port || "5432",
  PGDATABASE: db.pathname.slice(1),
  PGUSER: decodeURIComponent(db.username),
  PGPASSWORD: decodeURIComponent(db.password),
  PGCLIENTENCODING: "UTF8",
  PGCONNECT_TIMEOUT: "5",
};
function sql(input) {
  const r = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-f", "-"], {
    input,
    encoding: "utf8",
    env,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message);
  return r.stdout.trim();
}
if (process.argv.includes("--apply")) {
  for (const [migration, name] of [
    ["20261023200125", "teacher_availability_workspace"],
    ["20261023202030", "teacher_availability_paused_visibility"],
  ]) {
    const exists = sql(
      `select count(*) from supabase_migrations.schema_migrations where version='${migration}'`,
    );
    if (exists === "0") {
      const content = readFileSync(`supabase/migrations/${migration}_${name}.sql`, "utf8");
      sql(
        `begin;\n${content}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${migration}','${name}',array[$availability_migration$${content}$availability_migration$]);\ncommit;`,
      );
      console.log("Task migration applied to localhost; no other migrations or resets.");
    } else console.log("Task migration already applied.");
  }
}
if (process.argv.includes("--smoke")) {
  console.log(
    sql(readFileSync("harness/evidence/teacher-availability-redesign/smoke.sql", "utf8")),
  );
}
