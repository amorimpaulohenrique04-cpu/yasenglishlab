-- Stage 04d (ADR 0016): Student cancellation with access until the end of the paid cycle.
-- Marker + date, idempotency, own-subscription only, access held until the end then suspended, revert.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- true when the statement is denied with insufficient_privilege (42501); any other error propagates.
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege then return true; end $$;
-- SQLSTATE raised by the statement, or 'OK' when it succeeds.
create function pg_temp.state_of(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;

-- C1 ACTIVE (paid cycle 5 days ago), C2 ACTIVE without recorded cycle, C3 other ACTIVE student,
-- C4 student without subscription, C5 PAST_DUE with a future period end, C6 CANCELLED without period end,
-- T teacher and A admin, both with an ACTIVE subscription row.
insert into auth.users(id,email) values
 ('9e000000-0000-4000-8000-000000000001','cancel-c1@example.test'),
 ('9e000000-0000-4000-8000-000000000002','cancel-c2@example.test'),
 ('9e000000-0000-4000-8000-000000000003','cancel-c3@example.test'),
 ('9e000000-0000-4000-8000-000000000004','cancel-c4@example.test'),
 ('9e000000-0000-4000-8000-000000000005','cancel-c5@example.test'),
 ('9e000000-0000-4000-8000-000000000006','cancel-c6@example.test'),
 ('9e000000-0000-4000-8000-000000000007','cancel-teacher@example.test'),
 ('9e000000-0000-4000-8000-000000000008','cancel-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('9e000000-0000-4000-8000-000000000001','STUDENT'),('9e000000-0000-4000-8000-000000000002','STUDENT'),
 ('9e000000-0000-4000-8000-000000000003','STUDENT'),('9e000000-0000-4000-8000-000000000004','STUDENT'),
 ('9e000000-0000-4000-8000-000000000005','STUDENT'),('9e000000-0000-4000-8000-000000000006','STUDENT'),
 ('9e000000-0000-4000-8000-000000000007','TEACHER'),('9e000000-0000-4000-8000-000000000008','ADMIN');
insert into public.teachers(id,user_id) values('9e100000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000007');
insert into public.enrollments(id,user_id,course_id,status)
select ('9e200000-0000-4000-8000-00000000000'||n)::uuid, ('9e000000-0000-4000-8000-00000000000'||n)::uuid,
  '40000000-0000-4000-8000-000000000001','ACTIVE' from generate_series(1,6) n;
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status,billing_last_cycle_date) values
 ('9e300000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000003','test','sub_cancel_c1','ACTIVE',current_date - 5),
 ('9e300000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000003','test','sub_cancel_c2','ACTIVE',null),
 ('9e300000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000003','test','sub_cancel_c3','ACTIVE',current_date),
 ('9e300000-0000-4000-8000-000000000007','9e000000-0000-4000-8000-000000000007','10000000-0000-0000-0000-000000000003','test','sub_cancel_t','ACTIVE',current_date),
 ('9e300000-0000-4000-8000-000000000008','9e000000-0000-4000-8000-000000000008','10000000-0000-0000-0000-000000000003','test','sub_cancel_a','ACTIVE',current_date);
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status,current_period_end) values
 ('9e300000-0000-4000-8000-000000000005','9e000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000003','test','sub_cancel_c5','PAST_DUE',now() + interval '10 days'),
 ('9e300000-0000-4000-8000-000000000006','9e000000-0000-4000-8000-000000000006','10000000-0000-0000-0000-000000000003','test','sub_cancel_c6','CANCELLED',null);
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,meeting_provider,meeting_ref) values
 ('9e400000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000001','WORKSHOP','Cancel booking',now()+interval '2 days',now()+interval '2 days 1 hour',6,null,'SCHEDULED','MANUAL_EXTERNAL','https://meet.example.test/cancel');

-- 1. Surface: only authenticated may call; the decision helper stays closed.
select pg_temp.assert_true(has_function_privilege('authenticated','public.request_subscription_cancellation()','EXECUTE'),'authenticated can request cancellation');
select pg_temp.assert_true(not has_function_privilege('anon','public.request_subscription_cancellation()','EXECUTE'),'anon cannot request cancellation');
select pg_temp.assert_true(has_function_privilege('authenticated','public.revert_subscription_cancellation_request()','EXECUTE'),'authenticated can revert');
select pg_temp.assert_true(not has_function_privilege('anon','public.revert_subscription_cancellation_request()','EXECUTE'),'anon cannot revert');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.has_paid_access(uuid)','EXECUTE'),'has_paid_access stays closed to clients');
select pg_temp.assert_true(not has_function_privilege('anon','private.has_paid_access(uuid)','EXECUTE'),'has_paid_access stays closed to anon');

-- 2. Rule updates keep their baseline: PAST_DUE with a future period end and CANCELLED without one stay suspended.
select pg_temp.assert_true(private.has_paid_access('9e000000-0000-4000-8000-000000000001'),'ACTIVE has paid access');
select pg_temp.assert_true(not private.has_paid_access('9e000000-0000-4000-8000-000000000005'),'PAST_DUE stays suspended even with a future period end');
select pg_temp.assert_true(not private.has_paid_access('9e000000-0000-4000-8000-000000000006'),'CANCELLED without paid-until stays suspended');
-- Stage 11 (ADR 0017): no subscription and no grant means no paid access; staff stay exempt.
select pg_temp.assert_true(not private.has_paid_access('9e000000-0000-4000-8000-000000000004'),'user without subscription has NO paid access (fail-closed)');
select pg_temp.assert_true(private.has_paid_access('9e000000-0000-4000-8000-000000000007'),'TEACHER is never gated');

-- 3. C1 requests cancellation of its own subscription.
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('cancel.r1',(public.request_subscription_cancellation())::text,true);
reset role;
select pg_temp.assert_true((current_setting('cancel.r1')::jsonb->>'subscription_id')='9e300000-0000-4000-8000-000000000001','request targets the caller subscription');
select pg_temp.assert_true((current_setting('cancel.r1')::jsonb->>'provider_subscription_id')='sub_cancel_c1','request returns the provider subscription id');
select pg_temp.assert_true((current_setting('cancel.r1')::jsonb->>'status')='ACTIVE','request reports ACTIVE');
select pg_temp.assert_true(not (current_setting('cancel.r1')::jsonb->>'already_requested')::boolean,'first request is not a repeat');
select pg_temp.assert_true((current_setting('cancel.r1')::jsonb->>'access_until')::timestamptz
  = ((select billing_last_cycle_date from public.subscriptions where id='9e300000-0000-4000-8000-000000000001') + interval '1 month')::timestamp at time zone 'America/Recife',
  'access ends at last paid due date plus one month');
select pg_temp.assert_true((current_setting('cancel.r1')::jsonb->>'access_until')::timestamptz > now(),'paid access is in the future');
select pg_temp.assert_true((select cancel_at_period_end and status='ACTIVE' and current_period_end=(current_setting('cancel.r1')::jsonb->>'access_until')::timestamptz
  from public.subscriptions where id='9e300000-0000-4000-8000-000000000001'),'marker and paid-until are stored while still ACTIVE');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='subscription_cancellation_requested' and entity_id='9e300000-0000-4000-8000-000000000001' and actor_user_id='9e000000-0000-4000-8000-000000000001'),'request is audited once');
select pg_temp.assert_true((select not (data::text ~* '(@|email|cpf)') from public.audit_logs where action='subscription_cancellation_requested' and entity_id='9e300000-0000-4000-8000-000000000001'),'audit carries no PII');

-- 4. Idempotent: repeating does not move the date nor audit again.
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('cancel.r1b',(public.request_subscription_cancellation())::text,true);
reset role;
select pg_temp.assert_true((current_setting('cancel.r1b')::jsonb->>'already_requested')::boolean,'repeat is flagged');
select pg_temp.assert_true((current_setting('cancel.r1b')::jsonb->>'access_until')=(current_setting('cancel.r1')::jsonb->>'access_until'),'repeat keeps the same date');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='subscription_cancellation_requested' and entity_id='9e300000-0000-4000-8000-000000000001'),'repeat is not audited again');

-- 5. Only the caller own subscription: C3 cancelling never touches C1; no-subscription, unpaid, staff and anonymous are denied.
select pg_temp.login('9e000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('cancel.r3',(public.request_subscription_cancellation())::text,true);
reset role;
select pg_temp.assert_true((current_setting('cancel.r3')::jsonb->>'subscription_id')='9e300000-0000-4000-8000-000000000003','C3 cancels its own subscription');
select pg_temp.assert_true((select current_period_end=(current_setting('cancel.r1')::jsonb->>'access_until')::timestamptz from public.subscriptions where id='9e300000-0000-4000-8000-000000000001'),'C3 request leaves C1 untouched');
select pg_temp.assert_true((select count(*)=0 from public.subscriptions where user_id not in ('9e000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000003') and cancel_at_period_end),'nobody else was marked');
select pg_temp.login('9e000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.request_subscription_cancellation()')='P0002','student without subscription cannot cancel');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.request_subscription_cancellation()')='P0002','PAST_DUE student has no ACTIVE subscription to cancel');
reset role;
select pg_temp.assert_true((select not cancel_at_period_end and current_period_end > now() from public.subscriptions where id='9e300000-0000-4000-8000-000000000005'),'denied request did not touch PAST_DUE row');
select pg_temp.login('9e000000-0000-4000-8000-000000000007','aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.request_subscription_cancellation()'),'teacher cannot request cancellation');
select pg_temp.assert_true(pg_temp.denied('select public.revert_subscription_cancellation_request()'),'teacher cannot revert');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000008','aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.request_subscription_cancellation()'),'admin cannot request cancellation');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.subscriptions where user_id in ('9e000000-0000-4000-8000-000000000007','9e000000-0000-4000-8000-000000000008') and cancel_at_period_end),'staff rows never marked');
select pg_temp.logout();
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.request_subscription_cancellation()'),'authenticated role without a user is denied');
select pg_temp.assert_true(pg_temp.denied('select public.revert_subscription_cancellation_request()'),'revert without a user is denied');
reset role;
set local role anon;
select pg_temp.assert_true(pg_temp.denied('select public.request_subscription_cancellation()'),'anon cannot request cancellation');
select pg_temp.assert_true(pg_temp.denied('select public.revert_subscription_cancellation_request()'),'anon cannot revert');
reset role;

-- 6. Provider webhook (SUBSCRIPTION_DELETED effect in reconcile_billing_event): CANCELLED, ended_at set,
--    marker reset, current_period_end untouched. Access holds until the paid cycle ends.
update public.subscriptions set status='CANCELLED', ended_at=greatest(started_at,clock_timestamp()), cancel_at_period_end=false
where id='9e300000-0000-4000-8000-000000000001';
select pg_temp.assert_true(private.has_paid_access('9e000000-0000-4000-8000-000000000001'),'CANCELLED with future paid-until keeps paid access');
select pg_temp.assert_true(private.entitlement_limit('9e000000-0000-4000-8000-000000000001',(select key from public.entitlements where id='20000000-0000-0000-0000-000000000001')) is not null,'CANCELLED within the paid cycle keeps entitlements');
select pg_temp.assert_true(exists(select 1 from private.booking_entitlement('9e000000-0000-4000-8000-000000000001',(select key from public.entitlements where id='20000000-0000-0000-0000-000000000001'),now())),'CANCELLED within the paid cycle keeps booking entitlement');
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'CANCELLED within the paid cycle reads material');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'CANCELLED within the paid cycle reads lesson asset');
select pg_temp.assert_true(public.book_live_session('9e400000-0000-4000-8000-000000000001') is not null,'CANCELLED within the paid cycle can still book');
select set_config('cancel.r1c',(public.request_subscription_cancellation())::text,true);
reset role;
select pg_temp.assert_true((current_setting('cancel.r1c')::jsonb->>'status')='CANCELLED' and (current_setting('cancel.r1c')::jsonb->>'already_requested')::boolean,'retry after the webhook reports the fact');
select pg_temp.assert_true((current_setting('cancel.r1c')::jsonb->>'access_until')=(current_setting('cancel.r1')::jsonb->>'access_until'),'retry after the webhook keeps the date');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='subscription_cancellation_requested' and entity_id='9e300000-0000-4000-8000-000000000001'),'retry after the webhook is not audited again');

-- 7. Revert is only for the still-ACTIVE marker: a webhook-cancelled row is not revertible.
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(not (public.revert_subscription_cancellation_request()->>'reverted')::boolean,'CANCELLED row is not revertible');
reset role;
select pg_temp.assert_true((select status='CANCELLED' and current_period_end is not null from public.subscriptions where id='9e300000-0000-4000-8000-000000000001'),'revert attempt left CANCELLED row intact');

-- 8. After the paid cycle ends the ADR 0016 suspension applies.
update public.subscriptions set current_period_end = now() - interval '1 minute' where id='9e300000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not private.has_paid_access('9e000000-0000-4000-8000-000000000001'),'CANCELLED after paid-until is suspended');
select pg_temp.assert_true(private.entitlement_limit('9e000000-0000-4000-8000-000000000001',(select key from public.entitlements where id='20000000-0000-0000-0000-000000000001')) is null,'CANCELLED after paid-until has no entitlements');
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(not private.can_read_material('81710000-0000-4000-8000-000000000001'),'CANCELLED after paid-until cannot read material');
select pg_temp.assert_true(not private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'CANCELLED after paid-until cannot read lesson asset');
select pg_temp.assert_true(pg_temp.denied('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,30)'),'CANCELLED after paid-until cannot record progress');
reset role;

-- 9. Provider call failed: revert restores the pre-request state; repeat is a no-op; the user can request again.
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('cancel.r2',(public.request_subscription_cancellation())::text,true);
reset role;
select pg_temp.assert_true((current_setting('cancel.r2')::jsonb->>'provider_subscription_id')='sub_cancel_c2','C2 request returns its provider subscription');
select pg_temp.assert_true((current_setting('cancel.r2')::jsonb->>'access_until')::timestamptz <= clock_timestamp(),'no recorded paid cycle means no prepaid access');
select pg_temp.assert_true((select cancel_at_period_end and current_period_end is not null from public.subscriptions where id='9e300000-0000-4000-8000-000000000002'),'C2 marked');
-- Another student reverting never touches C2.
select pg_temp.login('9e000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.assert_true((public.revert_subscription_cancellation_request()->>'reverted')::boolean,'C3 reverts its own marker');
reset role;
select pg_temp.assert_true((select cancel_at_period_end from public.subscriptions where id='9e300000-0000-4000-8000-000000000002'),'C3 revert left C2 marked');
select pg_temp.assert_true((select not cancel_at_period_end and current_period_end is null from public.subscriptions where id='9e300000-0000-4000-8000-000000000003'),'C3 restored to pre-request state');
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true((public.revert_subscription_cancellation_request()->>'reverted')::boolean,'C2 reverts after a provider failure');
select pg_temp.assert_true(not (public.revert_subscription_cancellation_request()->>'reverted')::boolean,'revert is idempotent');
reset role;
select pg_temp.assert_true((select status='ACTIVE' and not cancel_at_period_end and current_period_end is null from public.subscriptions where id='9e300000-0000-4000-8000-000000000002'),'revert restores ACTIVE without marker or date');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='subscription_cancellation_reverted' and entity_id='9e300000-0000-4000-8000-000000000002'),'revert audited once');
select pg_temp.assert_true(private.has_paid_access('9e000000-0000-4000-8000-000000000002'),'reverted subscription keeps paid access');
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(not (public.request_subscription_cancellation()->>'already_requested')::boolean,'a new request after revert is fresh');
reset role;
select pg_temp.logout();
rollback;
