-- Stage 05a: ADMIN read-only Billing operations (rejected/ignored events, stuck checkouts,
-- failed/overdue notification deliveries). Allow/deny, column-level privacy and paging bounds.
-- All data is synthetic and rolled back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- Passes only when the statement fails with the expected SQLSTATE (default insufficient_privilege).
create function pg_temp.denied(command text, expected text default '42501')
returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected then return; else raise; end if;
  end;
  raise exception 'Expected denial %: %', expected, command;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
  ('a5000000-0000-4000-8000-000000000001', 'billops-admin@example.test', '{"display_name":"Billops Admin"}'),
  ('a5000000-0000-4000-8000-000000000002', 'billops-student@example.test', '{"display_name":"Billops Student"}'),
  ('a5000000-0000-4000-8000-000000000003', 'billops-teacher@example.test', '{"display_name":"Billops Teacher"}'),
  ('a5000000-0000-4000-8000-000000000004', 'billops-support@example.test', '{"display_name":"Billops Support"}'),
  ('a5000000-0000-4000-8000-000000000005', 'billops-co1@example.test', '{"display_name":"Checkout Person One"}'),
  ('a5000000-0000-4000-8000-000000000006', 'billops-co2@example.test', '{"display_name":"Checkout Person Two"}'),
  ('a5000000-0000-4000-8000-000000000007', 'billops-co3@example.test', '{"display_name":"Checkout Person Three"}'),
  ('a5000000-0000-4000-8000-000000000008', 'billops-co4@example.test', '{"display_name":"Checkout Person Four"}'),
  ('a5000000-0000-4000-8000-000000000009', 'billops-co5@example.test', '{"display_name":"Checkout Person Five"}');
insert into public.user_roles(user_id, role) values
  ('a5000000-0000-4000-8000-000000000001', 'ADMIN'),
  ('a5000000-0000-4000-8000-000000000002', 'STUDENT'),
  ('a5000000-0000-4000-8000-000000000003', 'TEACHER'),
  ('a5000000-0000-4000-8000-000000000004', 'SUPPORT')
on conflict (user_id, role) do nothing;

-- Billing events. Payload and provider event ids carry sentinel values that must never surface.
insert into public.billing_events(id, provider, event_id, event_type, payload, occurred_at, processed_at, processing_error) values
  ('a5100000-0000-4000-8000-000000000001', 'ASAAS', 'evt_SECRETEVENTID_rejected', 'CONFIRMED',
    '{"customer":{"email":"leak@example.test","cpf":"98765432100"},"paymentId":"pay_SECRETPAYMENT"}',
    now() - interval '1 hour', now() - interval '59 minutes', 'AMOUNT_MISMATCH'),
  ('a5100000-0000-4000-8000-000000000002', 'ASAAS', 'evt_SECRETEVENTID_freetext', 'PAYMENT_FAILED',
    '{"customer":{"email":"leak@example.test"}}',
    now() - interval '2 hours', now() - interval '119 minutes', 'unexpected text for leak@example.test'),
  ('a5100000-0000-4000-8000-000000000003', 'ASAAS', 'evt_SECRETEVENTID_ignored', 'IGNORED',
    '{"customer":{"email":"leak@example.test"}}',
    now() - interval '30 minutes', now() - interval '29 minutes', null),
  ('a5100000-0000-4000-8000-000000000004', 'ASAAS', 'evt_SECRETEVENTID_applied', 'CONFIRMED',
    '{"customer":{"email":"leak@example.test"}}',
    now() - interval '10 minutes', now() - interval '9 minutes', null);
-- 55 extra IGNORED events (older than the fixtures above) to exercise the page limit.
insert into public.billing_events(provider, event_id, event_type, payload, occurred_at, processed_at)
select 'ASAAS', 'evt_a5_bulk_' || n, 'IGNORED', '{"bulk":true}',
  now() - interval '1 day' - make_interval(mins => n), now() - interval '1 day' - make_interval(mins => n)
from generate_series(1, 55) n;

-- Checkout sessions (one open session per user at most). Plan 1 is START in the seed.
insert into public.billing_checkout_sessions(id, user_id, plan_id, status, provider_checkout_id, amount_cents, currency, plan_name, next_due_date, created_at, expires_at) values
  -- stuck: orphan CREATING
  ('a5200000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000001', 'CREATING', null, 9990, 'BRL', 'Start', current_date, now() - interval '2 hours', null),
  -- not stuck: recent CREATING
  ('a5200000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000001', 'CREATING', null, 9990, 'BRL', 'Start', current_date, now() - interval '5 minutes', null),
  -- stuck: READY past expiry
  ('a5200000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000001', 'READY', 'a5210000-0000-4000-8000-000000000003', 9990, 'BRL', 'Start', current_date, now() - interval '3 hours', now() - interval '10 minutes'),
  -- not stuck: READY still valid
  ('a5200000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000001', 'READY', 'a5210000-0000-4000-8000-000000000004', 9990, 'BRL', 'Start', current_date, now() - interval '20 minutes', now() + interval '40 minutes'),
  -- not stuck: terminal states
  ('a5200000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000001', 'PAID', 'a5210000-0000-4000-8000-000000000005', 9990, 'BRL', 'Start', current_date, now() - interval '4 hours', now() - interval '3 hours'),
  ('a5200000-0000-4000-8000-000000000006', 'a5000000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000001', 'EXPIRED', null, 9990, 'BRL', 'Start', current_date, now() - interval '5 hours', null);

-- Notifications + deliveries. Title/body sentinels must never surface.
insert into public.notifications(id, user_id, notification_type, title, body) values
  ('a5300000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002', 'PAYMENT_FAILED', 'SECRET-TITLE', 'SECRET-BODY billops-student@example.test'),
  ('a5300000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002', 'PAYMENT_CONFIRMED', 'SECRET-TITLE', 'SECRET-BODY billops-student@example.test'),
  ('a5300000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000002', 'PAYMENT_RENEWED', 'SECRET-TITLE', 'SECRET-BODY billops-student@example.test'),
  ('a5300000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000002', 'PAYMENT_CONFIRMED', 'SECRET-TITLE', 'SECRET-BODY billops-student@example.test'),
  ('a5300000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000002', 'PAYMENT_CONFIRMED', 'SECRET-TITLE', 'SECRET-BODY billops-student@example.test');
insert into public.notification_deliveries(id, notification_id, status, attempt_count, first_attempt_at, next_attempt_at, last_error_code, created_at, updated_at) values
  -- FAILED (terminal)
  ('a5400000-0000-4000-8000-000000000001', 'a5300000-0000-4000-8000-000000000001', 'FAILED', 5, now() - interval '3 hours', null, 'MAX_ATTEMPTS', now() - interval '3 hours', now() - interval '2 hours'),
  -- PENDING and overdue
  ('a5400000-0000-4000-8000-000000000002', 'a5300000-0000-4000-8000-000000000002', 'PENDING', 1, now() - interval '2 hours', now() - interval '1 hour', 'PROVIDER_UNAVAILABLE', now() - interval '2 hours', now() - interval '2 hours'),
  -- PENDING, not overdue yet
  ('a5400000-0000-4000-8000-000000000003', 'a5300000-0000-4000-8000-000000000003', 'PENDING', 0, null, now() + interval '1 minute', null, now(), now());
insert into public.notification_deliveries(id, notification_id, status, attempt_count, first_attempt_at, next_attempt_at, provider_message_id, sent_at, created_at) values
  -- SENT (never listed)
  ('a5400000-0000-4000-8000-000000000004', 'a5300000-0000-4000-8000-000000000004', 'SENT', 1, now() - interval '5 hours', null, 'msg_a5_sent', now() - interval '5 hours', now() - interval '5 hours');
insert into public.notification_deliveries(id, notification_id, status, attempt_count, first_attempt_at, next_attempt_at, claim_token, lease_until, created_at) values
  -- SENDING (never listed)
  ('a5400000-0000-4000-8000-000000000005', 'a5300000-0000-4000-8000-000000000005', 'SENDING', 1, now() - interval '4 hours', null, 'a5410000-0000-4000-8000-000000000005', now() + interval '2 minutes', now() - interval '4 hours');

-- 1. Grants: authenticated only; no table access was widened for clients.
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.admin_billing_rejected_events(text,integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_billing_stuck_checkouts(integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_notification_failures(text,integer,integer)', 'EXECUTE'),
  'authenticated may execute the three admin billing RPCs');
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.admin_billing_rejected_events(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_billing_stuck_checkouts(integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_notification_failures(text,integer,integer)', 'EXECUTE'),
  'anon cannot execute the admin billing RPCs');
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.billing_checkout_sessions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT')
  and not has_column_privilege('authenticated', 'public.billing_events', 'payload', 'SELECT'),
  'clients still have no direct table/payload access');

-- 2. ADMIN aal2 reads; privacy of the returned columns.
select pg_temp.login('a5000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;

-- 2a. Rejected / ignored events.
select pg_temp.assert_true(
  (select count(*) = 3 from public.admin_billing_rejected_events(null, 50, 0)
     where id in ('a5100000-0000-4000-8000-000000000001', 'a5100000-0000-4000-8000-000000000002', 'a5100000-0000-4000-8000-000000000003')),
  'admin sees rejected and ignored fixtures');
select pg_temp.assert_true(
  not exists (select 1 from public.admin_billing_rejected_events(null, 50, 0) where id = 'a5100000-0000-4000-8000-000000000004'),
  'applied (processing_error null, not IGNORED) events are not listed');
select pg_temp.assert_true(
  (select outcome = 'REJECTED' and processing_error = 'AMOUNT_MISMATCH' and event_type = 'CONFIRMED'
     from public.admin_billing_rejected_events('REJECTED', 50, 0) where id = 'a5100000-0000-4000-8000-000000000001'),
  'rejected event exposes outcome, allowlisted error and event type');
select pg_temp.assert_true(
  (select processing_error = 'STATE_CONFLICT'
     from public.admin_billing_rejected_events('REJECTED', 50, 0) where id = 'a5100000-0000-4000-8000-000000000002'),
  'non-allowlisted processing_error is masked');
select pg_temp.assert_true(
  (select outcome = 'IGNORED' and processing_error is null
     from public.admin_billing_rejected_events('IGNORED', 50, 0) where id = 'a5100000-0000-4000-8000-000000000003'),
  'ignored event is classified IGNORED');
select pg_temp.assert_true(
  not exists (select 1 from public.admin_billing_rejected_events('IGNORED', 50, 0) where outcome <> 'IGNORED')
  and not exists (select 1 from public.admin_billing_rejected_events('REJECTED', 50, 0) where outcome <> 'REJECTED'),
  'status filter is exact');
select pg_temp.assert_true(
  (select array_agg(k order by k) = array['event_type', 'id', 'occurred_at', 'outcome', 'processed_at', 'processing_error', 'subscription_id']
   from (select distinct jsonb_object_keys(to_jsonb(t)) k from public.admin_billing_rejected_events(null, 50, 0) t) keys),
  'event projection exposes exactly the approved columns (no payload/event_id)');
select pg_temp.assert_true(
  (select coalesce(string_agg(to_jsonb(t)::text, ' '), '') !~* '(SECRET|leak@|@example|98765432100|pay_)'
   from public.admin_billing_rejected_events(null, 50, 0) t),
  'no payload, PII or provider ids in event rows');

-- 2b. Stuck checkouts.
select pg_temp.assert_true(
  (select array_agg(c.id) from public.admin_billing_stuck_checkouts(50, 0) c where c.id::text like 'a5200000-%')
    = array['a5200000-0000-4000-8000-000000000001'::uuid, 'a5200000-0000-4000-8000-000000000003'::uuid],
  'only the orphan CREATING and the expired READY are stuck, newest first');
select pg_temp.assert_true(
  (select status = 'CREATING' and stuck_reason = 'CREATING_TIMEOUT' and plan_code = 'START'
      and user_id = 'a5000000-0000-4000-8000-000000000005' and display_name = 'Checkout Person One'
      and has_subscription = false and expires_at is null
     from public.admin_billing_stuck_checkouts(50, 0) where id = 'a5200000-0000-4000-8000-000000000001'),
  'CREATING row exposes status, reason, plan code, internal user and display name');
select pg_temp.assert_true(
  (select status = 'READY' and stuck_reason = 'READY_PAST_EXPIRY' and expires_at is not null
     from public.admin_billing_stuck_checkouts(50, 0) where id = 'a5200000-0000-4000-8000-000000000003'),
  'READY row is past expiry');
select pg_temp.assert_true(
  (select array_agg(k order by k) = array['created_at', 'display_name', 'expires_at', 'has_subscription', 'id', 'plan_code', 'status', 'stuck_reason', 'user_id']
   from (select distinct jsonb_object_keys(to_jsonb(t)) k from public.admin_billing_stuck_checkouts(50, 0) t) keys),
  'checkout projection exposes exactly the approved columns (no provider id/amount/e-mail)');
select pg_temp.assert_true(
  (select coalesce(string_agg(to_jsonb(t)::text, ' '), '') !~* '(@|a5210000-)'
   from public.admin_billing_stuck_checkouts(50, 0) t),
  'no e-mail or provider checkout id in checkout rows');

-- 2c. Notification failures.
select pg_temp.assert_true(
  (select array_agg(d.id order by d.id) from public.admin_notification_failures(null, 50, 0) d where d.id::text like 'a5400000-%')
    = array['a5400000-0000-4000-8000-000000000001'::uuid, 'a5400000-0000-4000-8000-000000000002'::uuid],
  'FAILED and overdue PENDING are listed; fresh PENDING, SENT and SENDING are not');
select pg_temp.assert_true(
  (select status = 'FAILED' and attempt_count = 5 and last_error_code = 'MAX_ATTEMPTS' and notification_type = 'PAYMENT_FAILED'
     from public.admin_notification_failures('FAILED', 50, 0) where id = 'a5400000-0000-4000-8000-000000000001'),
  'FAILED delivery exposes status, attempts, allowlisted error code and type');
select pg_temp.assert_true(
  (select status = 'PENDING' and last_error_code = 'PROVIDER_UNAVAILABLE'
     from public.admin_notification_failures('PENDING', 50, 0) where id = 'a5400000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.admin_notification_failures('PENDING', 50, 0) where status <> 'PENDING'),
  'PENDING filter is exact');
select pg_temp.assert_true(
  (select array_agg(k order by k) = array['attempt_count', 'created_at', 'id', 'last_error_code', 'next_attempt_at', 'notification_type', 'status', 'updated_at']
   from (select distinct jsonb_object_keys(to_jsonb(t)) k from public.admin_notification_failures(null, 50, 0) t) keys),
  'delivery projection exposes exactly the approved columns (no recipient/title/body/idempotency key)');
select pg_temp.assert_true(
  (select coalesce(string_agg(to_jsonb(t)::text, ' '), '') !~* '(SECRET|@|msg_a5|notification-email)'
   from public.admin_notification_failures(null, 50, 0) t),
  'no recipient, e-mail, title/body or provider ids in delivery rows');

-- 3. Paging bounds and ordering.
select pg_temp.assert_true((select count(*) = 50 from public.admin_billing_rejected_events(null, 50, 0)), 'page is capped at the requested 50');
select pg_temp.assert_true((select count(*) = 5 from public.admin_billing_rejected_events(null, 5, 0)), 'smaller limit is honored');
select pg_temp.assert_true(
  (select count(*) >= 8 from public.admin_billing_rejected_events(null, 50, 50))
  and not exists (
    select 1 from public.admin_billing_rejected_events(null, 50, 0) p1
    join public.admin_billing_rejected_events(null, 50, 50) p2 on p2.id = p1.id),
  'offset advances to a disjoint second page');
select pg_temp.assert_true(
  (select array_agg(e.occurred_at) = array_agg(e.occurred_at order by e.occurred_at desc)
   from public.admin_billing_rejected_events(null, 50, 0) e),
  'events are ordered by occurred_at desc');
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 51, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 0, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, null, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, -1)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 10001)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(''STALE'', 25, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_rejected_events(''rejected'', 25, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(51, 0)', '22023');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, -1)', '22023');
select pg_temp.denied('select * from public.admin_notification_failures(null, 51, 0)', '22023');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, -1)', '22023');
select pg_temp.denied('select * from public.admin_notification_failures(''SENT'', 25, 0)', '22023');
-- Even an ADMIN has no direct table path to the protected data.
select pg_temp.denied('select payload from public.billing_events');
select pg_temp.denied('select * from public.billing_checkout_sessions');
select pg_temp.denied('select * from public.notification_deliveries');
reset role;

-- 4. ADMIN without aal2 is denied (MFA/AAL2 not weakened).
select pg_temp.login('a5000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;
-- JWT without any aal claim behaves like aal1.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
reset role;

-- 5. Other roles are denied even with aal2.
select pg_temp.login('a5000000-0000-4000-8000-000000000002', 'aal2'); -- STUDENT
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;
select pg_temp.login('a5000000-0000-4000-8000-000000000003', 'aal2'); -- TEACHER
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;
select pg_temp.login('a5000000-0000-4000-8000-000000000004', 'aal2'); -- SUPPORT
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;

-- 6. authenticated without a subject, and anon, are denied.
select pg_temp.logout();
set local role authenticated;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;
set local role anon;
select pg_temp.denied('select * from public.admin_billing_rejected_events(null, 25, 0)');
select pg_temp.denied('select * from public.admin_billing_stuck_checkouts(25, 0)');
select pg_temp.denied('select * from public.admin_notification_failures(null, 25, 0)');
reset role;

-- 7. Reads are side-effect free.
select pg_temp.assert_true(
  (select count(*) = 4 from public.billing_events where id::text like 'a5100000-%')
  and (select count(*) = 6 from public.billing_checkout_sessions where id::text like 'a5200000-%')
  and (select status = 'FAILED' and attempt_count = 5 from public.notification_deliveries where id = 'a5400000-0000-4000-8000-000000000001'),
  'read RPCs do not mutate billing or notification state');
rollback;
