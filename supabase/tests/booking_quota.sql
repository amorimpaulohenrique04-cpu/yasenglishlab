begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%', message; end if; end $$;
insert into auth.users(id,email) values
 ('9b000000-0000-0000-0000-000000000001','quota-a@example.test'),
 ('9b000000-0000-0000-0000-000000000002','quota-b@example.test'),
 ('9b000000-0000-0000-0000-000000000003','quota-teacher@example.test');
insert into public.user_roles(user_id,role) values
 ('9b000000-0000-0000-0000-000000000001','STUDENT'),
 ('9b000000-0000-0000-0000-000000000002','STUDENT'),
 ('9b000000-0000-0000-0000-000000000003','TEACHER');
insert into public.teachers(id,user_id) values('9b100000-0000-0000-0000-000000000001','9b000000-0000-0000-0000-000000000003');
insert into public.subscriptions(user_id,plan_id,provider,status) values
 ('9b000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','test','ACTIVE'),
 ('9b000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','test','ACTIVE');
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key)
select ('9b200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'9b100000-0000-0000-0000-000000000001',
  case when n<=3 then 'CORE_CLASS' else 'PRIVATE_SESSION' end,'Quota session '||n,
  ts,ts+interval '45 minutes',case when n<=3 then 6 else 1 end,
  case when n<=3 then 'weekly_core_classes' else 'monthly_private_sessions' end
from (select n, case when n<=3 then
  (date_trunc('week',now() at time zone 'America/Recife')+interval '2 weeks 12 hours'+case when n=3 then interval '1 week' else (n-1)*interval '1 day' end) at time zone 'America/Recife'
  else (date_trunc('month',now() at time zone 'America/Recife')+interval '2 months 8 days 12 hours'+case when n=6 then interval '1 month' else (n-4)*interval '1 day' end) at time zone 'America/Recife' end ts
  from generate_series(1,6) n) fixtures;

set local role authenticated;
select set_config('request.jwt.claim.sub','9b000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"9b000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
select public.book_live_session('9b200000-0000-0000-0000-000000000001');
select pg_temp.assert_true(public.book_live_session_result('9b200000-0000-0000-0000-000000000002')->>'reason'='QUOTA_EXCEEDED','WEEK second booking must deny');
select public.book_live_session('9b200000-0000-0000-0000-000000000003');
select public.book_live_session('9b200000-0000-0000-0000-000000000004');
select pg_temp.assert_true(public.book_live_session_result('9b200000-0000-0000-0000-000000000005')->>'reason'='QUOTA_EXCEEDED','MONTH second booking must deny');
select public.book_live_session('9b200000-0000-0000-0000-000000000006');
select pg_temp.assert_true(public.book_live_session('9b200000-0000-0000-0000-000000000001')=
 (select id from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000001'),'retry with full quota must preserve UUID');
select public.cancel_live_booking('9b200000-0000-0000-0000-000000000001');
select public.cancel_live_booking('9b200000-0000-0000-0000-000000000001');
select public.book_live_session('9b200000-0000-0000-0000-000000000002');
select pg_temp.assert_true(public.book_live_session_result('9b200000-0000-0000-0000-000000000001')->>'reason'='QUOTA_EXCEEDED','rebooking must recheck quota');
select public.cancel_live_booking('9b200000-0000-0000-0000-000000000002');
select public.book_live_session('9b200000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*) from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000001')=1,'rebooking must not duplicate a row');
reset role;
select pg_temp.assert_true((select count(*) from public.audit_logs where actor_user_id='9b000000-0000-0000-0000-000000000001' and action='quota_denied')=3,'result RPC quota denial audit must survive inner rollback');
set local role authenticated;
do $$ begin
 begin perform public.book_live_session('9b200000-0000-0000-0000-000000000002');
  raise exception 'legacy wrapper unexpectedly booked over quota'; exception when check_violation then
  if sqlerrm<>'booking quota exceeded' then raise; end if;
 end;
end $$;
reset role;
select pg_temp.assert_true((select count(*) from public.audit_logs where actor_user_id='9b000000-0000-0000-0000-000000000001' and action='quota_denied')=3,'legacy wrapper raised denial rolls back its audit; result boundary is required');
select pg_temp.assert_true((select usage_window_start from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000001') =
 date_trunc('week',(now() at time zone 'America/Recife')+interval '2 weeks') at time zone 'America/Recife','quota uses session window not booking time');

select set_config('request.jwt.claim.sub','9b000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"9b000000-0000-0000-0000-000000000003","aal":"aal2"}',true);
set local role authenticated;
select public.mark_teacher_attendance((select id from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000001'),'NO_SHOW');
reset role;
select pg_temp.assert_true(private.booking_quota('9b000000-0000-0000-0000-000000000001','weekly_core_classes',
 (select starts_at from public.live_sessions where id='9b200000-0000-0000-0000-000000000001'))->>'used'='1','NO_SHOW must retain commercial usage');
set local role authenticated;
select public.cancel_teacher_live_session('9b200000-0000-0000-0000-000000000001');
reset role;
select pg_temp.assert_true((select status='TEACHER_CANCELLED' from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000001'),'teacher cancellation must release booking');
select set_config('request.jwt.claim.sub','9b000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"9b000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
set local role authenticated;
select public.book_live_session('9b200000-0000-0000-0000-000000000002');
reset role;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.session_bookings','UPDATE'),'booking DML remains denied');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.session_bookings','usage_limit','SELECT'),'commercial snapshot must not leak through Data API');
select pg_temp.assert_true((select count(*) from public.attendance a join public.session_bookings b on b.id=a.session_booking_id where b.user_id='9b000000-0000-0000-0000-000000000001')=1,'attendance stays a separate unique fact');
select pg_temp.assert_true((select window_start from private.booking_usage_window('2030-01-07 02:59:59+00','WEEK'))='2029-12-31 03:00:00+00'::timestamptz,'Sunday Recife belongs to previous week');
select pg_temp.assert_true((select window_start from private.booking_usage_window('2030-02-01 02:59:59+00','MONTH'))='2030-01-01 03:00:00+00'::timestamptz,'month boundary uses Recife');
select pg_temp.assert_true((select window_start is null from private.booking_usage_window(now(),'NONE')),'NONE has no recurring window');
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key)
values('9b200000-0000-0000-0000-000000000007','9b100000-0000-0000-0000-000000000001','CORE_CLASS','Late cancellation history',now()-interval '1 day',now()-interval '23 hours',6,'weekly_core_classes');
insert into public.session_bookings(live_session_id,user_id) values('9b200000-0000-0000-0000-000000000007','9b000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub','9b000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"9b000000-0000-0000-0000-000000000002","aal":"aal1"}',true);
set local role authenticated;
select public.cancel_live_booking('9b200000-0000-0000-0000-000000000007');
reset role;
select pg_temp.assert_true(private.booking_quota('9b000000-0000-0000-0000-000000000002','weekly_core_classes',now()-interval '1 day')->>'used'='1','late Student cancellation must retain commercial usage');
select pg_temp.assert_true(private.booking_quota('9b000000-0000-0000-0000-000000000002',null,now())->>'allowed'='true','no recurring key must remain uncapped');
do $$ begin
 begin update public.session_bookings set usage_limit=999 where live_session_id='9b200000-0000-0000-0000-000000000007';
  raise exception 'snapshot mutation was accepted'; exception when check_violation then
  if sqlerrm<>'booking usage snapshot is immutable' then raise; end if;
 end;
end $$;
update public.plan_entitlements set limit_value=2 where plan_id='10000000-0000-0000-0000-000000000003'
 and entitlement_id=(select id from public.entitlements where key='weekly_core_classes') and effective_to is null;
select pg_temp.assert_true((select usage_limit=1 from public.session_bookings where live_session_id='9b200000-0000-0000-0000-000000000007'),'config mutation must not rewrite commercial snapshot');
select pg_temp.assert_true(private.booking_quota('9b000000-0000-0000-0000-000000000002','weekly_core_classes',now()-interval '1 day')->>'total'='2.00','new decision resolves current config while preserving old consumption');
update public.plan_entitlements set limit_value=0 where plan_id='10000000-0000-0000-0000-000000000003'
 and entitlement_id=(select id from public.entitlements where key='weekly_core_classes') and effective_to is null;
select pg_temp.assert_true(private.booking_quota('9b000000-0000-0000-0000-000000000002','weekly_core_classes',now())->>'reason'='ENTITLEMENT_REQUIRED','zero limit denies recurring capability');
update public.plan_entitlements set limit_value=1.5 where plan_id='10000000-0000-0000-0000-000000000003'
 and entitlement_id=(select id from public.entitlements where key='weekly_core_classes') and effective_to is null;
do $$ begin
 begin perform private.booking_quota('9b000000-0000-0000-0000-000000000002','weekly_core_classes',now());
  raise exception 'fractional live quota accepted'; exception when check_violation then
  if sqlerrm<>'Live recurring entitlement limit must be an integer' then raise; end if;
 end;
end $$;
rollback;
