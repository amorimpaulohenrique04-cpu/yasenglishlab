-- Teacher availability: authorization, create/recurrence, overlap, validation, pause/resume, dependency blocking,
-- idempotent retry and next-free projection (merged adjacent slots, 5-minute rounding). Every fixture is rolled back.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$ select ('f9b00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Availability: %',message; end if; end $$;
create function pg_temp.login(n integer,aal text default 'aal2') returns void language sql as $$ select set_config('request.jwt.claim.sub',pg_temp.u(n)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.u(n),'role','authenticated','aal',aal)::text,true) $$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command; exception when others then if sqlstate=expected then return; else raise; end if; end;
 raise exception 'Expected denial % for: %',expected,command;
end $$;
create function pg_temp.mutate(input jsonb) returns jsonb language sql as $$ select public.mutate_teacher_availability(gen_random_uuid(),input) $$;
create function pg_temp.create_one(day text,start_time text,end_time text) returns jsonb language sql as $$
 select pg_temp.mutate(jsonb_build_object('action','CREATE','date',day,'until',day,'repeat',false,'weekdays','[]'::jsonb,'startTime',start_time,'endTime',end_time)) $$;

-- Users: 1 student; 9001 main teacher, 9002 other teacher, 9003 next-free teacher, 9004 future-slot teacher.
insert into auth.users(id,email) select pg_temp.u(n),'availability-ws-'||n||'@example.test' from (select 1 n union all select 9001 union all select 9002 union all select 9003 union all select 9004) ids;
insert into public.profiles(user_id,display_name) values(pg_temp.u(1),'Availability Student') on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.user_roles(user_id,role) values(pg_temp.u(1),'STUDENT') on conflict do nothing;
insert into public.user_roles(user_id,role) select pg_temp.u(n),'TEACHER' from unnest(array[9001,9002,9003,9004]) n on conflict do nothing;
insert into public.teachers(id,user_id) select pg_temp.u(n),pg_temp.u(n) from unnest(array[9001,9002,9003,9004]) n;
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.u(9001),pg_temp.u(1),now()-interval '30 days'),(pg_temp.u(9003),pg_temp.u(1),now()-interval '30 days');

select ((now() at time zone 'America/Recife')::date+1000)::text as first_day,((now() at time zone 'America/Recife')::date+1021)::text as last_day,
 extract(dow from (now() at time zone 'America/Recife')::date+1000)::integer as weekday,
 ((now() at time zone 'America/Recife')::date+1002)::text as other_day,
 ((now() at time zone 'America/Recife')::date-1)::text as yesterday \gset

-- Authorization: students, anon and AAL1 teachers are denied.
select pg_temp.login(1); set local role authenticated;
select pg_temp.denied($$select public.teacher_availability_workspace(now(),now()+interval '7 days')$$);
select pg_temp.denied($$select public.mutate_teacher_availability(gen_random_uuid(),'{"action":"CREATE"}')$$);
reset role;
select pg_temp.login(9001,'aal1'); set local role authenticated;
select pg_temp.denied($$select public.teacher_availability_workspace(now(),now()+interval '7 days')$$);
select pg_temp.denied($$select public.mutate_teacher_availability(gen_random_uuid(),'{"action":"DELETE"}')$$);
reset role;
set local role anon;
select pg_temp.denied($$select public.teacher_availability_workspace(now(),now()+interval '7 days')$$);
select pg_temp.denied($$select public.mutate_teacher_availability(gen_random_uuid(),'{"action":"DELETE"}')$$);
reset role;

-- One-off and weekly recurring creation.
select pg_temp.login(9001); set local role authenticated;
select pg_temp.denied($$select public.teacher_availability_workspace(now(),now()+interval '9 days')$$,'22023');
select pg_temp.denied($$select public.teacher_availability_workspace(now(),now())$$,'22023');
select pg_temp.ok((pg_temp.create_one(:'other_day','09:00','10:00')->>'count')::integer=1,'one-off creates exactly one interval');
select pg_temp.ok((select series_id is null and active from public.teacher_availability where teacher_id=pg_temp.u(9001) and (starts_at at time zone 'America/Recife')::date=:'other_day'::date),'one-off has no series and is active');
select jsonb_build_object('action','CREATE','date',:'first_day','until',:'last_day','repeat',true,'weekdays',jsonb_build_array(:weekday),'startTime','14:00','endTime','16:00') as weekly_input \gset
select gen_random_uuid() as weekly_op \gset
select pg_temp.ok((public.mutate_teacher_availability(:'weekly_op',:'weekly_input'::jsonb)->>'count')::integer=4,'weekly series materializes four occurrences');
select series_id,id as first_id from public.teacher_availability where teacher_id=pg_temp.u(9001) and (starts_at at time zone 'America/Recife')::date=:'first_day'::date \gset
select pg_temp.ok((select count(*)=4 and bool_and(extract(hour from starts_at at time zone 'America/Recife')=14 and extract(hour from ends_at at time zone 'America/Recife')=16) from public.teacher_availability where series_id=:'series_id'),'occurrences keep Recife wall time');

-- Idempotent retry by operation id; same id with different input is a conflict.
select pg_temp.ok((public.mutate_teacher_availability(:'weekly_op',:'weekly_input'::jsonb)->>'count')::integer=4,'identical retry returns the stored result');
select pg_temp.ok((select count(*)=4 from public.teacher_availability where series_id=:'series_id'),'retry did not duplicate rows');
select pg_temp.denied(format('select public.mutate_teacher_availability(%L,%L::jsonb)',:'weekly_op',jsonb_build_object('action','CREATE','date',:'first_day','until',:'last_day','repeat',true,'weekdays',jsonb_build_array(:weekday),'startTime','10:00','endTime','11:00')),'23514');
select pg_temp.denied($$select public.mutate_teacher_availability(null,'{"action":"DELETE"}')$$,'22023');
select pg_temp.denied($$select public.mutate_teacher_availability(gen_random_uuid(),'{"action":"BOGUS"}')$$,'22023');

-- Validation: end <= start, malformed time, past date.
select pg_temp.denied(format('select pg_temp.create_one(%L,%L,%L)',:'first_day','15:00','15:00'),'22023');
select pg_temp.denied(format('select pg_temp.create_one(%L,%L,%L)',:'first_day','16:00','15:00'),'22023');
select pg_temp.denied(format('select pg_temp.create_one(%L,%L,%L)',:'first_day','9:00','10:00'),'22023');
select pg_temp.denied(format('select pg_temp.create_one(%L,%L,%L)',:'yesterday','09:00','10:00'),'22023');
select pg_temp.denied(format('select pg_temp.mutate(%L::jsonb)',jsonb_build_object('action','EDIT','id',:'first_id','scope','occurrence','startTime','17:00','endTime','16:00')),'22023');

-- Overlap: against existing intervals (nothing written), touching intervals allowed, edit-induced overlap rejected.
-- A single batch cannot overlap itself (one interval per day), so batch atomicity is checked against existing rows.
select pg_temp.ok(pg_temp.create_one(:'first_day','15:00','17:00')->>'code'='OVERLAP','partial overlap with an existing interval is denied');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','CREATE','date',:'first_day','until',:'last_day','repeat',true,'weekdays',jsonb_build_array(:weekday),'startTime','15:00','endTime','15:30'))->>'code'='OVERLAP','recurring batch overlapping every date is denied');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','CREATE','date',((:'first_day')::date-7)::text,'until',:'last_day','repeat',true,'weekdays',jsonb_build_array(:weekday),'startTime','13:00','endTime','14:30'))->>'code'='OVERLAP','batch with only some colliding dates is denied');
select pg_temp.ok((select count(*)=5 from public.teacher_availability where teacher_id=pg_temp.u(9001)),'conflicting batches wrote nothing (all-or-nothing)');
select pg_temp.ok((pg_temp.create_one(:'first_day','16:00','17:00')->>'ok')::boolean,'touching after is allowed');
select pg_temp.ok((pg_temp.create_one(:'first_day','12:00','14:00')->>'ok')::boolean,'touching before is allowed');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','EDIT','id',:'first_id','scope','occurrence','startTime','14:00','endTime','16:30'))->>'code'='OVERLAP','edit growing into a neighbour is denied');
select pg_temp.ok((select extract(hour from ends_at at time zone 'America/Recife')=16 and extract(minute from ends_at at time zone 'America/Recife')=0 from public.teacher_availability where id=:'first_id'),'denied edit preserved the interval');

-- Pause / resume: occurrence scope vs series (future) scope.
select id as second_id from public.teacher_availability where series_id=:'series_id' order by starts_at offset 1 limit 1 \gset
select pg_temp.ok((pg_temp.mutate(jsonb_build_object('action','PAUSE','id',:'second_id','scope','occurrence'))->>'count')::integer=1,'pause occurrence affects one interval');
select pg_temp.ok((select count(*) filter(where not active)=1 and count(*) filter(where active)=3 from public.teacher_availability where series_id=:'series_id'),'only the chosen occurrence is paused');
select pg_temp.ok((pg_temp.mutate(jsonb_build_object('action','RESUME','id',:'second_id','scope','occurrence'))->>'ok')::boolean,'resume occurrence');
select pg_temp.ok((pg_temp.mutate(jsonb_build_object('action','PAUSE','id',:'second_id','scope','future'))->>'count')::integer=3,'pause future covers this and later occurrences');
select pg_temp.ok((select active from public.teacher_availability where id=:'first_id') and (select count(*)=3 from public.teacher_availability where series_id=:'series_id' and not active),'earlier occurrence remains active');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.get_teacher_session_workspace(null,null,null)->'availability') a where a->>'id'=:'second_id'),'paused interval is not offered for sessions');
select pg_temp.ok((pg_temp.mutate(jsonb_build_object('action','RESUME','id',:'second_id','scope','future'))->>'count')::integer=3,'resume future restores the series');
select pg_temp.ok((select count(*)=4 from public.teacher_availability where series_id=:'series_id' and active),'series fully active again');

-- Dependent scheduled session blocks pause / delete / uncovering edit; independent occurrences can be deleted.
select public.manage_teacher_session(null,jsonb_build_object('session_type','PRIVATE_SESSION','title','Availability dependency','starts_at',(:'first_day'::date+time '14:30') at time zone 'America/Recife','ends_at',(:'first_day'::date+time '15:00') at time zone 'America/Recife','capacity',1,'target_student_user_id',pg_temp.u(1))) as session_id \gset
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','PAUSE','id',:'first_id','scope','occurrence'))->>'code'='DEPENDENCY','pause blocked by dependent session');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','DELETE','id',:'first_id','scope','occurrence'))->>'code'='DEPENDENCY','delete blocked by dependent session');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','DELETE','id',:'first_id','scope','future'))->>'code'='DEPENDENCY','delete of the whole future series blocked');
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','EDIT','id',:'first_id','scope','occurrence','startTime','15:30','endTime','16:00'))->>'code'='DEPENDENCY','edit that uncovers the session is blocked');
select pg_temp.ok((select count(*)=4 and bool_and(active) from public.teacher_availability where series_id=:'series_id'),'blocked mutations preserved original state');
select pg_temp.ok((pg_temp.mutate(jsonb_build_object('action','DELETE','id',:'second_id','scope','occurrence'))->>'ok')::boolean,'free occurrence deletes');
select pg_temp.ok((select count(*)=3 from public.teacher_availability where series_id=:'series_id'),'only one occurrence was deleted');

-- Weekly projection and ownership.
select pg_temp.ok(jsonb_array_length(public.teacher_availability_workspace((:'first_day'::date::timestamp at time zone 'America/Recife'),((:'first_day'::date+7)::timestamp at time zone 'America/Recife'))->'slots')=4,'week projection contains the four slots of the first week');
select pg_temp.ok(jsonb_array_length(public.teacher_availability_workspace((:'first_day'::date::timestamp at time zone 'America/Recife'),((:'first_day'::date+7)::timestamp at time zone 'America/Recife'))->'sessions')=1,'week projection contains the dependent session');
reset role;

select pg_temp.login(9002); set local role authenticated;
select pg_temp.ok(jsonb_array_length(public.teacher_availability_workspace((:'first_day'::date::timestamp at time zone 'America/Recife'),((:'first_day'::date+7)::timestamp at time zone 'America/Recife'))->'slots')=0,'other teacher workspace does not expose foreign slots');
select pg_temp.denied(format('select pg_temp.mutate(%L::jsonb)',jsonb_build_object('action','PAUSE','id',:'first_id','scope','occurrence')));
select pg_temp.denied(format('select pg_temp.mutate(%L::jsonb)',jsonb_build_object('action','DELETE','id',:'first_id','scope','future')));
select pg_temp.denied($$update public.teacher_availability set active=false$$);
select pg_temp.denied($$delete from public.teacher_availability$$);
select pg_temp.denied($$insert into public.teacher_availability(teacher_id,starts_at,ends_at) values(gen_random_uuid(),now()+interval '1 day',now()+interval '2 days')$$);
-- Teacher without any active availability: next_free is null.
select pg_temp.ok(public.teacher_availability_workspace(now(),now()+interval '1 day')->'next_free'='null'::jsonb,'no active availability yields null next_free');
reset role;

-- next_free: back-to-back availability is merged and the start is "now" rounded up to 5 minutes.
-- Fixture inserted directly (superuser) because writers refuse started intervals: A started 1h ago, B starts exactly when A ends.
insert into public.teacher_availability(teacher_id,starts_at,ends_at,active) values
 (pg_temp.u(9003),now()-interval '1 hour',now()+interval '73 minutes',true),
 (pg_temp.u(9003),now()+interval '73 minutes',now()+interval '133 minutes',true),
 (pg_temp.u(9003),now()+interval '133 minutes',now()+interval '193 minutes',false),
 (pg_temp.u(9003),now()-interval '5 hours',now()-interval '4 hours',true);
select (now()+interval '133 minutes') as merged_end \gset
select pg_temp.login(9003); set local role authenticated;
select public.teacher_availability_workspace(now()-interval '1 day',now()+interval '1 day')->'next_free' as nf \gset
select pg_temp.ok(:'nf'::jsonb<>'null'::jsonb,'next_free exists');
select pg_temp.ok((:'nf'::jsonb->>'starts_at')::timestamptz>=now()-interval '1 second' and (:'nf'::jsonb->>'starts_at')::timestamptz<now()+interval '5 minutes','next_free starts within the next five minutes');
select pg_temp.ok(extract(epoch from (:'nf'::jsonb->>'starts_at')::timestamptz)::bigint % 300=0,'next_free start is on a 5-minute boundary (no odd minutes)');
select pg_temp.ok((:'nf'::jsonb->>'ends_at')::timestamptz=:'merged_end'::timestamptz,'adjacent active slots are merged; paused neighbour excluded');
-- A scheduled session inside the merged range truncates the first free interval at the session start.
select public.manage_teacher_session(null,jsonb_build_object('session_type','PRIVATE_SESSION','title','Availability next free','starts_at',date_trunc('minute',now())+interval '30 minutes','ends_at',date_trunc('minute',now())+interval '60 minutes','capacity',1,'target_student_user_id',pg_temp.u(1))) as nf_session \gset
select public.teacher_availability_workspace(now()-interval '1 day',now()+interval '1 day')->'next_free' as nf2 \gset
select pg_temp.ok((:'nf2'::jsonb->>'ends_at')::timestamptz=date_trunc('minute',now())+interval '30 minutes','free interval ends where the next session begins');
select pg_temp.ok(extract(epoch from (:'nf2'::jsonb->>'starts_at')::timestamptz)::bigint % 300=0,'rounding still applies when a session follows');
-- A started interval is read-only.
select id as started_id from public.teacher_availability where teacher_id=pg_temp.u(9003) and starts_at<now() and ends_at>now() \gset
select pg_temp.ok(pg_temp.mutate(jsonb_build_object('action','PAUSE','id',:'started_id','scope','occurrence'))->>'code'='PAST','started interval cannot be changed');
reset role;

-- A purely future slot keeps its own start (not rounded); an ended slot never appears.
insert into public.teacher_availability(teacher_id,starts_at,ends_at,active) values
 (pg_temp.u(9004),date_trunc('hour',now())+interval '3 hours 7 minutes',date_trunc('hour',now())+interval '4 hours 7 minutes',true),
 (pg_temp.u(9004),now()-interval '3 hours',now()-interval '2 hours',true);
select pg_temp.login(9004); set local role authenticated;
select pg_temp.ok((public.teacher_availability_workspace(now()-interval '1 day',now()+interval '1 day')->'next_free'->>'starts_at')::timestamptz=date_trunc('hour',now())+interval '3 hours 7 minutes','future slot start is preserved');
reset role;
rollback;
select 'Availability workspace passed; fixture changes rolled back';
