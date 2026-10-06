import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const args = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  "55484",
  "-U",
  "postgres",
  "-d",
  "yas_stage03b",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atqc",
];
function sql(query) {
  const r = spawnSync("psql", [...args, query], { encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function parallel(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...args, query], { windowsHide: true });
    let out = "",
      err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err += c));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim().split(/\r?\n/).at(-1)) : reject(new Error(err)),
    );
  });
}
for (const [n, scenario] of [
  [1, "same event"],
  [2, "distinct events same activation"],
  [3, "conflicting subscription activations"],
]) {
  const user = `bc000000-0000-4000-8000-00000000000${n}`;
  sql(
    `insert into auth.users(id) values ('${user}'); insert into public.user_roles(user_id,role) values ('${user}','STUDENT');`,
  );
  const reservation = JSON.parse(sql(`select public.reserve_billing_checkout('${user}','START')`));
  const events = Array.from({ length: 8 }, (_, i) => ({
    provider: "ASAAS",
    eventId: `evt_concurrent_${n}_${n === 1 ? 0 : i}`,
    sourceType: "fixture",
    occurredAt: "2026-10-06T10:00:00.000Z",
    action: "CONFIRMED",
    sessionId: reservation.sessionId,
    checkoutId: null,
    subscriptionId: `sub_concurrent_${n}_${n === 3 ? i : 0}`,
    paymentId: "pay_concurrent",
    amountCents: reservation.amountCents,
    currency: "BRL",
    cycleDate: "2026-10-06",
  }));
  // Independent connections synchronize their invocation at a database clock
  // barrier, so the calls contend rather than merely being sequential retries.
  const barrier = sql("select extract(epoch from clock_timestamp())+2");
  const results = await Promise.all(
    events.map((event) =>
      parallel(
        `select pg_sleep(greatest(0,${barrier}-extract(epoch from clock_timestamp()))); set role service_role; select public.reconcile_billing_event('${JSON.stringify(event)}'::jsonb);`,
      ),
    ),
  );
  assert.equal(results.filter((r) => r === "APPLIED").length, 1, JSON.stringify(results));
  assert.equal(
    results.filter((r) => r === (n === 1 ? "DUPLICATE" : n === 2 ? "STALE" : "REJECTED")).length,
    7,
  );
  assert.equal(sql(`select count(*) from public.subscriptions where user_id='${user}'`), "1");
  assert.equal(sql(`select count(*) from public.placement_cases where user_id='${user}'`), "1");
  assert.equal(
    sql(`select count(*) from public.billing_events where event_id like 'evt_concurrent_${n}_%'`),
    n === 1 ? "1" : "8",
  );
  assert.equal(
    sql(
      `select count(*) from public.audit_logs where action='billing_reconciled' and data->>'event_id' like 'evt_concurrent_${n}_%'`,
    ),
    "1",
  );
  console.log(
    `PASS: ${scenario}; 8 concurrent PostgreSQL connections, 1 subscription/Placement/effect`,
  );
}
