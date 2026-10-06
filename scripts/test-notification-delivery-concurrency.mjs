import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Isolated local/CI proof. Never connects to a linked/remote Supabase project.
const databaseUrl = process.env.DATABASE_URL;
const native = Boolean(databaseUrl || process.env.PGHOST);
if (native) {
  const host = databaseUrl ? new URL(databaseUrl).hostname : process.env.PGHOST;
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(host), "local database required");
}
const executable = native
  ? "psql"
  : process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";
function sql(statement, onClaim) {
  return new Promise((resolve, reject) => {
    const connection = native
      ? databaseUrl
        ? [`--dbname=${databaseUrl}`]
        : []
      : ["exec", "-i", "supabase_db_yasenglishlab", "psql", "-U", "postgres", "-d", "postgres"];
    const child = spawn(executable, [...connection, "-v", "ON_ERROR_STOP=1", "-Atq"]);
    let output = "",
      error = "",
      announced = false;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("CONCURRENCY_TEST_TIMEOUT"));
    }, 15_000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const line = output
        .split("\n")
        .slice(0, -1)
        .find((value) => value.startsWith("["));
      if (line && !announced) {
        announced = true;
        onClaim?.(JSON.parse(line));
      }
    });
    child.stderr.on("data", (chunk) => {
      error += chunk.toString();
    });
    child.on("error", (cause) => {
      clearTimeout(timeout);
      reject(cause);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(error || "LOCAL_SQL_FAILED"));
    });
    child.stdin.end(statement);
  });
}
const userId = "ae000000-0000-4000-8000-000000000030";
let created = false;
try {
  await sql(`begin;
    do $$ begin if exists(select 1 from public.notification_deliveries where status in ('PENDING','SENDING')) then raise exception 'requires isolated idle local outbox'; end if; end $$;
    insert into auth.users(id) values('${userId}');
    with n as (insert into public.notifications(user_id,notification_type,title,body)
      select '${userId}','PAYMENT_CONFIRMED','fixture','fixture' from generate_series(1,4) returning id)
    insert into public.notification_deliveries(notification_id) select id from n;
    commit;`);
  created = true;
  let ready;
  const held = new Promise((resolve) => {
    ready = resolve;
  });
  const worker = `begin; set local role service_role;
    select json_agg(delivery_id)::text from public.claim_notification_deliveries(2);
    select pg_sleep(1); commit;`;
  const first = sql(worker, ready);
  const firstIds = await Promise.race([
    held,
    first.then(() => {
      throw new Error("FIRST_WORKER_DID_NOT_CLAIM");
    }),
  ]);
  // Start worker two while worker one's row locks and transaction remain active.
  const second = sql(worker);
  const [, secondOutput] = await Promise.all([first, second]);
  const secondIds = JSON.parse(secondOutput.split("\n").find((line) => line.startsWith("[")));
  assert.equal(firstIds.length, 2);
  assert.equal(secondIds.length, 2);
  assert.equal(new Set([...firstIds, ...secondIds]).size, 4, "workers must claim disjoint rows");
  const final = await sql(
    `select count(*) || ':' || min(attempt_count) || ':' || max(attempt_count) from public.notification_deliveries d join public.notifications n on n.id=d.notification_id where n.user_id='${userId}' and d.status='SENDING';`,
  );
  assert.equal(final.trim(), "4:1:1");
  console.log(
    "PASS: two overlapping service workers, 2 + 2 disjoint deliveries, one attempt per row.",
  );
} finally {
  if (created) await sql(`delete from auth.users where id='${userId}';`);
}
