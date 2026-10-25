// Only localhost; checks run transactionally and never reset existing data.
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
const version = "20261023211118",
  name = "teacher_students_workspace";
const content = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
if (process.argv.includes("--check"))
  console.log(sql(`begin;\n${content}\nselect 'Migration compiles (rolled back)'; rollback;`));
if (process.argv.includes("--apply")) {
  if (
    sql(`select count(*) from supabase_migrations.schema_migrations where version='${version}'`) ===
    "0"
  ) {
    sql(
      `begin;\n${content}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$students_migration$${content}$students_migration$]); commit;`,
    );
    console.log("Only the students migration applied locally; existing data preserved.");
  } else console.log("Task migration already applied.");
}
if (process.argv.includes("--smoke"))
  console.log(sql(readFileSync("supabase/tests/teacher_students_workspace.sql", "utf8")));
