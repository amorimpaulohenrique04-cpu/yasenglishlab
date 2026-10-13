import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runAdmin, withBarrier } from "./_postgres-concurrency.mjs";

// Isolated local/CI proof (DATABASE_URL/PG* must point at a disposable database).
// Synthetic rows use random ids and are retained: billing_events is append-only.
const run = randomUUID().slice(0, 8);
const users = [];

function scalar(sql) {
  return runAdmin(sql).split(/\r?\n/).filter(Boolean).at(-1);
}
function attempt(sql) {
  try {
    return { ok: true, out: runAdmin(sql) };
  } catch (error) {
    return { ok: false, error: String(error.message) };
  }
}
function student() {
  const id = randomUUID();
  users.push(id);
  runAdmin(`insert into auth.users(id) values('${id}');
    insert into public.user_roles(user_id,role) values('${id}','STUDENT');`);
  return id;
}
function reserve(user) {
  const reservation = JSON.parse(
    scalar(`select public.reserve_billing_checkout('${user}','START')`),
  );
  assert.equal(reservation.claimed, true, "fresh reservation expected");
  return reservation;
}
function event(overrides) {
  return {
    provider: "ASAAS",
    eventId: `evt_${run}_${randomUUID().slice(0, 8)}`,
    sourceType: "PAYMENT_CONFIRMED",
    occurredAt: "2026-10-06T10:00:00Z",
    action: "CONFIRMED",
    sessionId: null,
    checkoutId: null,
    subscriptionId: null,
    paymentId: `pay_${run}_${randomUUID().slice(0, 8)}`,
    amountCents: null,
    currency: "BRL",
    cycleDate: "2026-10-06",
    ...overrides,
  };
}
const reconcile = (e) => `select public.reconcile_billing_event('${JSON.stringify(e)}'::jsonb)`;
const complete = (session, checkout) =>
  `select public.complete_billing_checkout('${session}','${checkout}')`;
const last = (result) => result.stdout.split(/\r?\n/).filter(Boolean).at(-1);

try {
  // (a1) Webhook (session + checkout ids) races complete_billing_checkout.
  {
    const user = student();
    const r = reserve(user);
    const checkout = randomUUID();
    const e = event({
      sessionId: r.sessionId,
      checkoutId: checkout,
      subscriptionId: `sub_${run}_a1`,
      amountCents: r.amountCents,
    });
    const results = await withBarrier(
      `select id from public.billing_checkout_sessions where id='${r.sessionId}' for update`,
      [reconcile(e), complete(r.sessionId, checkout)],
    );
    assert.ok(
      results.every((x) => x.code === 0),
      `webhook/complete race must not fail: ${JSON.stringify(results)}`,
    );
    assert.equal(
      scalar(
        `select status from public.subscriptions where provider_subscription_id='${e.subscriptionId}'`,
      ),
      "ACTIVE",
    );
    assert.equal(
      scalar(
        `select status||':'||provider_checkout_id from public.billing_checkout_sessions where id='${r.sessionId}'`,
      ),
      `PAID:${checkout}`,
    );
    assert.equal(
      scalar(`select count(*) from public.placement_cases where user_id='${user}'`),
      "1",
    );
    assert.equal(
      scalar(
        `select count(*) from public.billing_events where event_id='${e.eventId}' and processing_error is null`,
      ),
      "1",
      "applied event stored exactly once, not REJECTED",
    );
  }

  // (a2)+(c) Checkout-only webhook before the link: retry signal, nothing stored,
  // then the SAME event is reprocessed after completion (not DUPLICATE/REJECTED).
  {
    const user = student();
    const r = reserve(user);
    const checkout = randomUUID();
    const e = event({
      checkoutId: checkout,
      subscriptionId: `sub_${run}_a2`,
      amountCents: r.amountCents,
    });
    const early = attempt(reconcile(e));
    assert.equal(early.ok, false, "unlinked checkout must signal retry");
    assert.match(early.error, /BILLING_EVENT_RETRY/);
    assert.equal(
      scalar(`select count(*) from public.billing_events where event_id='${e.eventId}'`),
      "0",
    );
    assert.equal(scalar(`select count(*) from public.subscriptions where user_id='${user}'`), "0");
    runAdmin(complete(r.sessionId, checkout));
    assert.equal(scalar(reconcile(e)), "APPLIED", "same transient event is reprocessable");
    assert.equal(scalar(reconcile(e)), "DUPLICATE", "applied event stays idempotent");
    assert.equal(
      scalar(`select status from public.subscriptions where user_id='${user}'`),
      "ACTIVE",
    );
    assert.equal(
      scalar(`select count(*) from public.billing_events where event_id='${e.eventId}'`),
      "1",
    );

    // Same shape, but the redelivery races a second identical delivery.
    const user2 = student();
    const r2 = reserve(user2);
    const checkout2 = randomUUID();
    const e2 = event({
      checkoutId: checkout2,
      subscriptionId: `sub_${run}_a2b`,
      amountCents: r2.amountCents,
    });
    assert.equal(attempt(reconcile(e2)).ok, false);
    runAdmin(complete(r2.sessionId, checkout2));
    const twice = await withBarrier(
      `select pg_advisory_xact_lock(hashtextextended('ASAAS:event:${e2.eventId}',3104))`,
      [reconcile(e2), reconcile(e2)],
    );
    assert.ok(
      twice.every((x) => x.code === 0),
      JSON.stringify(twice),
    );
    assert.deepEqual(twice.map(last).sort(), ["APPLIED", "DUPLICATE"]);
    assert.equal(scalar(`select count(*) from public.subscriptions where user_id='${user2}'`), "1");
  }

  // (b) PAYMENT_CONFIRMED and PAYMENT_RECEIVED for one payment, concurrent.
  {
    const user = student();
    const r = reserve(user);
    runAdmin(complete(r.sessionId, randomUUID()));
    const sub = `sub_${run}_b`;
    const payment = `pay_${run}_b`;
    const base = {
      sessionId: r.sessionId,
      subscriptionId: sub,
      paymentId: payment,
      amountCents: r.amountCents,
    };
    const confirmed = event({ ...base, sourceType: "PAYMENT_CONFIRMED" });
    const received = event({ ...base, sourceType: "PAYMENT_RECEIVED" });
    const results = await withBarrier(
      `select pg_advisory_xact_lock(hashtextextended('ASAAS:subscription:${sub}',3104))`,
      [reconcile(confirmed), reconcile(received)],
    );
    assert.ok(
      results.every((x) => x.code === 0),
      JSON.stringify(results),
    );
    assert.deepEqual(results.map(last).sort(), ["APPLIED", "STALE"], "exactly one application");
    assert.equal(scalar(`select count(*) from public.subscriptions where user_id='${user}'`), "1");
    assert.equal(
      scalar(`select count(*) from public.placement_cases where user_id='${user}'`),
      "1",
    );
    assert.equal(
      scalar(`select count(*) from public.audit_logs where action='billing_reconciled'
      and data->>'event_id' in ('${confirmed.eventId}','${received.eventId}')`),
      "1",
    );
    assert.equal(
      scalar(`select count(*) from public.notifications where user_id='${user}'
      and notification_type in ('PAYMENT_CONFIRMED','PAYMENT_RENEWED')`),
      "1",
      "one payment notification",
    );
    assert.equal(
      scalar(
        `select count(*) from public.notification_deliveries d join public.notifications n on n.id=d.notification_id where n.user_id='${user}'`,
      ),
      "1",
      "one delivery",
    );

    // Later RECEIVED (distinct timestamp) may be a second application, never a second notification.
    const user2 = student();
    const r2 = reserve(user2);
    runAdmin(complete(r2.sessionId, randomUUID()));
    const sub2 = `sub_${run}_b2`;
    const base2 = {
      sessionId: r2.sessionId,
      subscriptionId: sub2,
      paymentId: `pay_${run}_b2`,
      amountCents: r2.amountCents,
    };
    const c2 = event({ ...base2, sourceType: "PAYMENT_CONFIRMED" });
    const rc2 = event({
      ...base2,
      sourceType: "PAYMENT_RECEIVED",
      occurredAt: "2026-10-06T10:00:05Z",
    });
    const second = await withBarrier(
      `select pg_advisory_xact_lock(hashtextextended('ASAAS:subscription:${sub2}',3104))`,
      [reconcile(c2), reconcile(rc2)],
    );
    assert.ok(
      second.every((x) => x.code === 0),
      JSON.stringify(second),
    );
    assert.equal(scalar(`select count(*) from public.subscriptions where user_id='${user2}'`), "1");
    assert.equal(
      scalar(`select count(*) from public.placement_cases where user_id='${user2}'`),
      "1",
    );
    assert.equal(
      scalar(`select count(*) from public.notifications where user_id='${user2}'
      and notification_type in ('PAYMENT_CONFIRMED','PAYMENT_RENEWED')`),
      "1",
    );
  }
} finally {
  // Park fixture deliveries so the isolated-outbox guard of the notification suite stays valid on reruns.
  if (users.length)
    runAdmin(`update public.notification_deliveries set status='FAILED',last_error_code='PROCESSOR_ERROR'
      where status='PENDING' and notification_id in (select id from public.notifications
        where user_id in (${users.map((u) => `'${u}'`).join(",")}))`);
}

console.log(
  "PASS Billing webhook concurrency: webhook vs checkout completion ends ACTIVE without loss; unlinked checkout retries without a stored event and the same event is reprocessed; CONFIRMED/RECEIVED apply once with one notification.",
);
