-- Focused real-database checks. All fixture writes and operations are rolled back.
begin;
create function pg_temp.assert_availability(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message;end if;end $$;
select id as teacher_user from auth.users where email='teacher.dev@example.test' \gset
select id as teacher_id from public.teachers where user_id=:'teacher_user' \gset
select student_user_id as student_id from public.teacher_student_assignments where teacher_id=:'teacher_id' limit 1 \gset
select ((now() at time zone 'America/Recife')::date+1000)::text as first_day,((now() at time zone 'America/Recife')::date+1021)::text as last_day,
 extract(dow from (now() at time zone 'America/Recife')::date+1000)::integer as weekday \gset
select gen_random_uuid() as operation_id \gset
select set_config('request.jwt.claims',jsonb_build_object('sub',:'teacher_user','role','authenticated','aal','aal2')::text,true) \gset
set local role authenticated;
select jsonb_build_object('action','CREATE','date',:'first_day','until',:'last_day','repeat',true,'weekdays',jsonb_build_array(:weekday),'startTime','14:00','endTime','16:00') as create_input \gset
select pg_temp.assert_availability((public.mutate_teacher_availability(:'operation_id',:'create_input'::jsonb)->>'count')::integer=4,'four occurrences created');
select pg_temp.assert_availability((public.mutate_teacher_availability(:'operation_id',:'create_input'::jsonb)->>'count')::integer=4,'identical operation retry');
select id as first_id,series_id from public.teacher_availability where teacher_id=:'teacher_id' and (starts_at at time zone 'America/Recife')::date=:'first_day'::date \gset
select id as second_id,starts_at as second_start,ends_at as second_end from public.teacher_availability where series_id=:'series_id' order by starts_at offset 1 limit 1 \gset
select pg_temp.assert_availability((select count(*)=4 from public.teacher_availability where series_id=:'series_id'),'retry did not duplicate');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),:'create_input'::jsonb)->>'code'='OVERLAP','overlap denied');
select pg_temp.assert_availability((select count(*)=4 from public.teacher_availability where series_id=:'series_id'),'conflicting batch wrote nothing');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','PAUSE','id',:'first_id','scope','occurrence'))->>'ok'='true','pause one');
select pg_temp.assert_availability((select count(*) filter(where active)=3 from public.teacher_availability where series_id=:'series_id'),'only selected occurrence paused');
select pg_temp.assert_availability(not exists(select 1 from jsonb_array_elements(public.get_teacher_session_workspace(null,null,null)->'availability') a where a->>'id'=:'first_id'),'Sessions excludes paused intervals');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','RESUME','id',:'first_id','scope','occurrence'))->>'ok'='true','resume one');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','EDIT','id',:'first_id','scope','future','startTime','15:00','endTime','17:00'))->>'count'='4','edit all future');
select public.manage_teacher_session(null,jsonb_build_object('session_type','PRIVATE_SESSION','title','Availability smoke','starts_at',(:'first_day'::date+time '15:30') at time zone 'America/Recife','ends_at',(:'first_day'::date+time '16:00') at time zone 'America/Recife','capacity',1,'target_student_user_id',:'student_id')) as session_id \gset
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','PAUSE','id',:'first_id','scope','future'))->>'code'='DEPENDENCY','cannot pause coverage of scheduled session');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','DELETE','id',:'first_id','scope','future'))->>'code'='DEPENDENCY','cannot delete coverage of scheduled session');
select pg_temp.assert_availability((select active from public.teacher_availability where id=:'first_id'),'blocked mutation preserves original state');
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','PAUSE','id',:'second_id','scope','occurrence'))->>'ok'='true','pause another occurrence');
select set_config('availability.smoke_second',:'second_id',true) \gset
select set_config('availability.smoke_student',:'student_id',true) \gset
do $$ declare a public.teacher_availability; begin
 select * into a from public.teacher_availability where id=current_setting('availability.smoke_second')::uuid;
 begin perform public.manage_teacher_session(null,jsonb_build_object('session_type','PRIVATE_SESSION','title','Paused must fail','starts_at',a.starts_at,'ends_at',a.ends_at,'capacity',1,'target_student_user_id',current_setting('availability.smoke_student')));
 exception when check_violation then return;end;
 raise exception 'Paused availability allowed session creation';
end $$;
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','DELETE','id',:'second_id','scope','occurrence'))->>'ok'='true','delete a free occurrence');
select pg_temp.assert_availability(jsonb_array_length(public.teacher_availability_workspace((:'first_day'::date::timestamp at time zone 'America/Recife'),((:'first_day'::date+7)::timestamp at time zone 'America/Recife'))->'slots')=1,'week projection includes remaining slots');
select id as paused_id from public.teacher_availability where series_id=:'series_id' and id<>:'first_id' order by starts_at limit 1 \gset
select pg_temp.assert_availability(public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','PAUSE','id',:'paused_id','scope','occurrence'))->>'ok'='true','prepare private paused interval');
reset role;
select gen_random_uuid() as other_user, gen_random_uuid() as other_teacher \gset
insert into auth.users(id,email) values(:'other_user',:'other_user'||'@availability-smoke.example.test');
insert into public.user_roles(user_id,role) values(:'other_user','TEACHER');
insert into public.teachers(id,user_id) values(:'other_teacher',:'other_user');
select set_config('availability.smoke_target',:'first_id',true) \gset
select set_config('request.jwt.claims',jsonb_build_object('sub',:'other_user','role','authenticated','aal','aal2')::text,true) \gset
set local role authenticated;
select pg_temp.assert_availability(not exists(select 1 from public.teacher_availability where id=:'paused_id'),'other teacher cannot read paused interval');
select pg_temp.assert_availability(jsonb_array_length(public.teacher_availability_workspace((:'first_day'::date::timestamp at time zone 'America/Recife'),((:'first_day'::date+7)::timestamp at time zone 'America/Recife'))->'slots')=0,'other teacher workspace does not expose original teacher slots');
do $$ begin
 begin perform public.mutate_teacher_availability(gen_random_uuid(),jsonb_build_object('action','PAUSE','id',current_setting('availability.smoke_target'),'scope','occurrence'));exception when insufficient_privilege then return;end;
 raise exception 'Other teacher must not mutate interval';
end $$;
do $$ begin
 begin execute 'update public.teacher_availability set active=false';exception when insufficient_privilege then return;end;
 raise exception 'Direct DML must be denied';
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'teacher_user','role','authenticated','aal','aal1')::text,true) \gset
set local role authenticated;
do $$ begin
 begin perform public.mutate_teacher_availability(gen_random_uuid(),'{"action":"DELETE"}');exception when insufficient_privilege then return;end;
 raise exception 'AAL1 must be rejected';
end $$;
reset role;
rollback;
select 'Availability smoke passed; fixture changes rolled back' as result;
