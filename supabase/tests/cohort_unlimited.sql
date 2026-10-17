-- PR1 / 1B: cohorts have no student ceiling; live-session capacity (<= 6) is untouched.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9e000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email) select pg_temp.id(n),'unlimited-'||n||'@example.test' from generate_series(1,101) n;
insert into public.user_roles(user_id,role) select pg_temp.id(n),'STUDENT' from generate_series(1,101) n;
insert into public.enrollments(id,user_id,course_id,status)
 select pg_temp.id(1000+n),pg_temp.id(n),'40000000-0000-4000-8000-000000000001','ACTIVE' from generate_series(1,101) n;
insert into public.cohorts(id,course_id,name,code,status,timezone,starts_at)
 values(pg_temp.id(5000),'40000000-0000-4000-8000-000000000001','Unlimited','unlimited-cohort','ACTIVE','America/Recife',now()-interval '1 day');
insert into public.cohort_placement_settings(cohort_id,schedule) values(pg_temp.id(5000),'[{"weekday":1,"startMinute":1140,"endMinute":1200}]');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) select pg_temp.id(5000),pg_temp.id(n),pg_temp.id(1000+n) from generate_series(1,101) n;
do $$ begin
 if (select count(*) from public.cohort_memberships where cohort_id=pg_temp.id(5000) and status='ACTIVE')<>101 then raise exception '101 students must fit one cohort'; end if;
 if (select capacity from public.cohort_placement_settings where cohort_id=pg_temp.id(5000)) is not null then raise exception 'cohort capacity must stay unset'; end if;
end $$;
rollback;
