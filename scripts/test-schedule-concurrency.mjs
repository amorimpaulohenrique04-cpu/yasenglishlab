import { spawn, spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const connectionArgs = databaseUrl ? [`--dbname=${databaseUrl}`] : [];

function runAdmin(sql) {
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

const studentA = "86000000-0000-0000-0000-000000000001";
const studentB = "86000000-0000-0000-0000-000000000002";
const teacherUser = "86000000-0000-0000-0000-000000000003";
const teacherId = "86200000-0000-0000-0000-000000000001";
const sessionId = "86400000-0000-0000-0000-000000000001";

async function withBarrier(lockSql, operations) {
  const barrier = spawn("psql", [...connectionArgs, "-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    barrier.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("BARRIER_READY")) resolve();
    });
    barrier.on("error", reject);
  });
  barrier.stdin.write(`begin; ${lockSql}; select 'BARRIER_READY';\n`);
  await ready;
  const attempts = operations.map((sql) =>
    runConcurrent(`set application_name='yas-quota-race'; ${sql}`),
  );
  try {
    for (let poll = 0; poll < 100; poll++) {
      const waiting = Number(
        runAdmin(
          "select count(*) from pg_stat_activity where application_name='yas-quota-race' and wait_event_type='Lock'",
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

runAdmin(`
  insert into auth.users (id, email, raw_user_meta_data)
  values
    ('${studentA}', 'concurrency-a@example.test', '{"display_name":"Concurrency A"}'),
    ('${studentB}', 'concurrency-b@example.test', '{"display_name":"Concurrency B"}'),
    ('${teacherUser}', 'concurrency-teacher@example.test', '{"display_name":"Concurrency Teacher"}')
  on conflict (id) do nothing;

  insert into public.user_roles (id, user_id, role)
  values
    ('86100000-0000-0000-0000-000000000001', '${studentA}', 'STUDENT'),
    ('86100000-0000-0000-0000-000000000002', '${studentB}', 'STUDENT'),
    ('86100000-0000-0000-0000-000000000003', '${teacherUser}', 'TEACHER')
  on conflict (id) do nothing;

  insert into public.teachers (id, user_id, active)
  values ('${teacherId}', '${teacherUser}', true)
  on conflict (id) do update set active = true;

  insert into public.subscriptions (
    id, user_id, plan_id, provider, provider_subscription_id, status,
    current_period_start, current_period_end
  )
  values
    (
      '86300000-0000-0000-0000-000000000001', '${studentA}',
      '10000000-0000-0000-0000-000000000003', 'test', 'concurrency_a', 'ACTIVE',
      now() - interval '1 day', now() + interval '30 days'
    ),
    (
      '86300000-0000-0000-0000-000000000002', '${studentB}',
      '10000000-0000-0000-0000-000000000003', 'test', 'concurrency_b', 'ACTIVE',
      now() - interval '1 day', now() + interval '30 days'
    )
  on conflict (id) do update set
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end;

  delete from public.session_bookings where live_session_id = '${sessionId}';

  insert into public.live_sessions (
    id, teacher_id, session_type, title, starts_at, ends_at, capacity,
    required_entitlement_key, status
  )
  values (
    '${sessionId}', '${teacherId}', 'PRIVATE_SESSION', 'Real concurrency capacity one',
    now() + interval '4 days', now() + interval '4 days 45 minutes',
    1, 'monthly_private_sessions', 'SCHEDULED'
  )
  on conflict (id) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    capacity = excluded.capacity,
    required_entitlement_key = excluded.required_entitlement_key,
    status = excluded.status;
`);

function bookingSql(userId) {
  const claims = JSON.stringify({ sub: userId, aal: "aal1" }).replaceAll("'", "''");
  return `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    select public.book_live_session('${sessionId}');
  `;
}

const [attemptA, attemptB] = await withBarrier(
  `select id from public.live_sessions where id='${sessionId}' for update`,
  [bookingSql(studentA), bookingSql(studentB)],
);

const attempts = [attemptA, attemptB];
const winners = attempts.filter((attempt) => attempt.code === 0);
const rejected = attempts.filter((attempt) => attempt.code !== 0);

if (winners.length !== 1 || rejected.length !== 1) {
  throw new Error(
    `Expected exactly one concurrent winner and one rejection; got ${JSON.stringify(
      attempts.map(({ code, stderr }) => ({ code, stderr })),
    )}`,
  );
}

if (!rejected[0].stderr.toLowerCase().includes("capacity")) {
  throw new Error(`Concurrent loser was not rejected by the capacity guard: ${rejected[0].stderr}`);
}

const finalCount = Number(
  runAdmin(
    `select count(*) from public.session_bookings where live_session_id = '${sessionId}' and status = 'BOOKED';`,
  ),
);

if (finalCount !== 1) {
  throw new Error(`Concurrent booking overbooked capacity=1; final count was ${finalCount}.`);
}

console.log("✓ Agenda real concurrency passed: two concurrent users, exactly one BOOKED.");

const quotaSessions = [
  "86400000-0000-0000-0000-000000000002",
  "86400000-0000-0000-0000-000000000003",
];
runAdmin(`
  delete from public.session_bookings where user_id='${studentA}' and live_session_id in ('${quotaSessions.join("','")}');
  insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key)
  select id::uuid,'${teacherId}','CORE_CLASS','Quota concurrency',
    date_trunc('week',now())+interval '14 days 12 hours',date_trunc('week',now())+interval '14 days 13 hours',6,'weekly_core_classes'
  from unnest(array['${quotaSessions.join("','")}']) id
  on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at;
`);
function quotaBookingSql(id) {
  return `set role authenticated;
    select set_config('request.jwt.claim.sub','${studentA}',false);
    select set_config('request.jwt.claims','{"sub":"${studentA}","aal":"aal1"}',false);
    select public.book_live_session_result('${id}');`;
}
const quotaAttempts = await withBarrier(
  `select pg_advisory_xact_lock(hashtextextended('yas.booking:${studentA}',0))`,
  quotaSessions.map(quotaBookingSql),
);
if (
  quotaAttempts.some((attempt) => attempt.code !== 0) ||
  quotaAttempts.filter((attempt) => attempt.stdout.includes("QUOTA_EXCEEDED")).length !== 1
) {
  throw new Error(
    `Expected one quota winner and one durable denial: ${JSON.stringify(quotaAttempts)}`,
  );
}
const quotaCount = Number(
  runAdmin(
    `select count(*) from public.session_bookings where user_id='${studentA}' and live_session_id in ('${quotaSessions.join("','")}') and status='BOOKED'`,
  ),
);
if (quotaCount !== 1) throw new Error(`Concurrent quota exceeded: ${quotaCount}`);
console.log(
  "✓ Quota real concurrency passed: one Student, two distinct sessions, limit=1, exactly one BOOKED.",
);

const winnerSession = runAdmin(
  `select live_session_id from public.session_bookings where user_id='${studentA}' and live_session_id in ('${quotaSessions.join("','")}') and status='BOOKED'`,
);
const originalBooking = runAdmin(
  `select id from public.session_bookings where user_id='${studentA}' and live_session_id='${winnerSession}'`,
);
const retries = await withBarrier(
  `select id from public.live_sessions where id='${winnerSession}' for update`,
  [quotaBookingSql(winnerSession), quotaBookingSql(winnerSession)],
);
if (retries.some((r) => r.code !== 0 || !r.stdout.includes(originalBooking)))
  throw new Error("Concurrent retry changed booking identity or double spent quota.");
const cancellationSql = `set role authenticated;
 select set_config('request.jwt.claim.sub','${studentA}',false);
 select set_config('request.jwt.claims','{"sub":"${studentA}","aal":"aal1"}',false);
 select public.cancel_live_booking('${winnerSession}');`;
const cancellationRace = await withBarrier(
  `select id from public.live_sessions where id='${winnerSession}' for update`,
  [cancellationSql, quotaBookingSql(winnerSession)],
);
if (cancellationRace.some((r) => r.code !== 0)) throw new Error("Cancel/retry race failed.");
const finalUsage = Number(
  runAdmin(
    `select count(*) from public.session_bookings where user_id='${studentA}' and live_session_id in ('${quotaSessions.join("','")}') and status='BOOKED'`,
  ),
);
if (finalUsage > 1) throw new Error("Cancel/retry race exceeded quota.");
console.log(
  "✓ Real retry/cancellation concurrency passed: stable UUID and at most one consumed unit.",
);
