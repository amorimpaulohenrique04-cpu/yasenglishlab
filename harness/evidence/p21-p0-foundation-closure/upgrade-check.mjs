import { spawnSync } from "node:child_process";
const connection = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
function sql(text, expectedFailure = false) {
  const result = spawnSync("psql", [connection, "-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: text,
    encoding: "utf8",
  });
  if (expectedFailure) {
    if (result.status === 0 || !result.stderr.includes("Reconcile legacy CANCELLED"))
      throw new Error("Ambiguous legacy cancellation did not block rollout.");
    console.log(
      "PASS preflight: ambiguous cancellation blocks migration and transaction rolls back.",
    );
  } else {
    if (result.status !== 0) throw new Error(result.stderr);
    console.log(result.stdout.trim());
  }
}
sql(`
begin;
delete from public.subscriptions where user_id='9e000000-0000-0000-0000-000000000001';
delete from auth.users where id='9e000000-0000-0000-0000-000000000001';
insert into auth.users(id,email) values('9e000000-0000-0000-0000-000000000001','legacy-upgrade@example.test');
insert into auth.users(id,email) values('9e000000-0000-0000-0000-000000000002','legacy-teacher@example.test');
insert into public.user_roles(user_id,role) values('9e000000-0000-0000-0000-000000000002','TEACHER');
insert into public.teachers(id,user_id) values('9e100000-0000-0000-0000-000000000001','9e000000-0000-0000-0000-000000000002');
insert into public.user_roles(user_id,role) values('9e000000-0000-0000-0000-000000000001','STUDENT');
insert into public.subscriptions(user_id,plan_id,provider,status) values('9e000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test','ACTIVE');
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key)
select ('9e200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,(select id from public.teachers order by id limit 1),'CORE_CLASS','Legacy upgrade',
date_trunc('week',now())+interval '2 weeks 12 hours'+n*interval '1 day',date_trunc('week',now())+interval '2 weeks 13 hours'+n*interval '1 day',6,'weekly_core_classes'
from generate_series(1,4) n;
insert into public.session_bookings(id,live_session_id,user_id,status,booked_at,cancelled_at)
select ('9e300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('9e200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'9e000000-0000-0000-0000-000000000001',
case when n<=2 then 'BOOKED' else 'CANCELLED' end,case when n=3 then '2000-01-01'::timestamptz else now() end,
case when n=3 then now() else null end from generate_series(1,4) n;
select 'RED main: two bookings consumed limit=1 without recurring enforcement' where (select count(*) from public.session_bookings where user_id='9e000000-0000-0000-0000-000000000001' and status='BOOKED')=2;
commit;
`);
const { readFileSync } = await import("node:fs");
sql(
  "begin;" +
    readFileSync("supabase/migrations/20261002042103_live_booking_usage_snapshot.sql", "utf8") +
    "commit;",
  true,
);
sql("delete from public.session_bookings where id='9e300000-0000-0000-0000-000000000004';");
const migrated = spawnSync("supabase", ["migration", "up", "--local"], { stdio: "inherit" });
if (migrated.status !== 0) throw new Error("Upgrade migrations failed.");
sql(`
do $$ begin
 if (select count(*) from public.session_bookings where user_id='9e000000-0000-0000-0000-000000000001')<>3 then raise exception 'upgrade changed row identity/count'; end if;
 if (select usage_provenance from public.session_bookings where id='9e300000-0000-0000-0000-000000000003')<>'LEGACY_UNRESOLVED' then raise exception 'unrecoverable history invented'; end if;
 if exists(select 1 from public.live_sessions where id::text like '9e200000-%' and cohort_id is not null) then raise exception 'legacy cohort auto-assigned'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','9e000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"9e000000-0000-0000-0000-000000000001","aal":"aal1"}',false);
do $$ begin
 if public.book_live_session_result('9e200000-0000-0000-0000-000000000004')->>'reason'<>'QUOTA_EXCEEDED' then raise exception 'upgrade did not enforce quota'; end if;
 if public.book_live_session('9e200000-0000-0000-0000-000000000001')<>'9e300000-0000-0000-0000-000000000001'::uuid then raise exception 'legacy UUID contract changed'; end if;
end $$;
select 'PASS upgrade: legacy UUID/status retained, unresolved provenance explicit, quota enforced, cohorts nullable';
`);
