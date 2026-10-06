import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const args = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  "55483",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atqc",
];
function sql(query) {
  const result = spawnSync("psql", [...args, query], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const user = "fc000000-0000-4000-8000-000000000001";
sql(
  `insert into auth.users(id) values ('${user}'); insert into public.user_roles(user_id,role) values ('${user}','STUDENT');`,
);
try {
  const query = `set role service_role; select public.reserve_billing_checkout('${user}', 'START')->>'claimed';`;
  const results = await Promise.all(
    Array.from(
      { length: 8 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn("psql", [...args, query], { windowsHide: true });
          let out = "",
            err = "";
          child.stdout.on("data", (chunk) => (out += chunk));
          child.stderr.on("data", (chunk) => (err += chunk));
          child.on("error", reject);
          child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
        }),
    ),
  );
  assert.equal(results.filter((value) => value.endsWith("true")).length, 1);
  assert.equal(
    sql(`select count(*) from public.billing_checkout_sessions where user_id='${user}'`),
    "1",
  );
  console.log("PASS: 8 independent PostgreSQL sessions; 1 claim and 1 durable intent");
} finally {
  sql(
    `delete from public.billing_checkout_sessions where user_id='${user}'; delete from public.user_roles where user_id='${user}'; delete from auth.users where id='${user}';`,
  );
}
