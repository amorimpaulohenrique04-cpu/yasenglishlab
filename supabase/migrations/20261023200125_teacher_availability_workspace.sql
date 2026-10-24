-- Weekly series materialize finite, ordinary availability intervals. No background jobs.
create table public.teacher_availability_series (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.teachers(id),
 starts_on date not null, ends_on date not null,
 weekdays integer[] not null,
 created_at timestamptz not null default now(),
 check(ends_on>=starts_on and ends_on<=starts_on+365)
);
alter table public.teacher_availability_series enable row level security;
revoke all on public.teacher_availability_series from public,anon,authenticated;
grant select on public.teacher_availability_series to authenticated;
create policy availability_series_own on public.teacher_availability_series for select to authenticated
using(teacher_id=private.current_teacher_id());
alter table public.teacher_availability add column active boolean not null default true;
alter table public.teacher_availability add column series_id uuid references public.teacher_availability_series(id);
create index teacher_availability_series_occurrences on public.teacher_availability(series_id,starts_at);

create table public.teacher_availability_operations (
 teacher_id uuid not null references public.teachers(id), operation_id uuid not null,
 input jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(teacher_id,operation_id)
);
alter table public.teacher_availability_operations enable row level security;
revoke all on public.teacher_availability_operations from public,anon,authenticated;

create function public.teacher_availability_workspace(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '8 days' then raise exception 'Invalid week' using errcode='22023'; end if;
 select jsonb_build_object(
  'slots',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,'active',a.active,'series_id',a.series_id,
   'series_until',r.ends_on,'future_count',case when a.series_id is null then 1 else (select count(*) from public.teacher_availability f where f.series_id=a.series_id and f.starts_at>=a.starts_at and f.starts_at>now()) end,
   'future_until',case when a.series_id is null then a.ends_at else (select max(f.ends_at) from public.teacher_availability f where f.series_id=a.series_id and f.starts_at>=a.starts_at and f.starts_at>now()) end) order by a.starts_at,a.id)
   from public.teacher_availability a left join public.teacher_availability_series r on r.id=a.series_id
   where a.teacher_id=teacher and a.ends_at>p_from and a.starts_at<p_to),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at)
   from public.live_sessions s where s.teacher_id=teacher and s.status='SCHEDULED' and s.ends_at>p_from and s.starts_at<p_to),'[]'::jsonb),
  'next_free',(select jsonb_build_object('starts_at',lower(free),'ends_at',upper(free)) from public.teacher_availability a
   cross join lateral unnest(case when a.ends_at>now() then tstzmultirange(tstzrange(greatest(a.starts_at,now()),a.ends_at,'[)')) else '{}'::tstzmultirange end -
    coalesce((select range_agg(tstzrange(s.starts_at,s.ends_at,'[)')) from public.live_sessions s where s.teacher_id=teacher and s.status='SCHEDULED' and s.starts_at<a.ends_at and s.ends_at>a.starts_at),'{}'::tstzmultirange)) free
   where a.teacher_id=teacher and a.active and a.ends_at>now() order by lower(free) limit 1)
 ) into result;
 return result;
end $$;

create function public.mutate_teacher_availability(p_operation_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); action text:=p_input->>'action'; scope text:=coalesce(p_input->>'scope','occurrence');
 target public.teacher_availability; ids uuid[]:='{}'; proposed jsonb:='[]'; conflicts jsonb; result jsonb; previous public.teacher_availability_operations;
 first_day date; last_day date; weekdays integer[]; start_time time; end_time time; series uuid; count_rows integer;
begin
 -- Same Teacher serialization as the canonical session/availability writers.
 perform 1 from public.teachers where id=teacher for update;
 if p_operation_id is null or p_input is null or jsonb_typeof(p_input)<>'object' or action is null or action not in ('CREATE','EDIT','PAUSE','RESUME','DELETE') or scope is null or scope not in ('occurrence','future') then raise exception 'Invalid command' using errcode='22023'; end if;
 select * into previous from public.teacher_availability_operations where teacher_id=teacher and operation_id=p_operation_id;
 if found then
  if previous.input<>p_input then raise exception 'Conflicting retry' using errcode='23514'; end if;
  return previous.result;
 end if;
 if action<>'CREATE' then
  select * into target from public.teacher_availability where id=(p_input->>'id')::uuid and teacher_id=teacher for update;
  if target.id is null then raise exception 'Own interval required' using errcode='42501'; end if;
  if target.starts_at<=now() then return jsonb_build_object('ok',false,'code','PAST','message','Horários já iniciados ficam disponíveis apenas para consulta.','conflicts','[]'::jsonb); end if;
  select array_agg(id) into ids from public.teacher_availability a where a.teacher_id=teacher and a.starts_at>now()
   and (a.id=target.id or (scope='future' and target.series_id is not null and a.series_id=target.series_id and a.starts_at>=target.starts_at));
 end if;
 if action in ('CREATE','EDIT') then
  if (p_input->>'startTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (p_input->>'endTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid time' using errcode='22023'; end if;
  start_time:=(p_input->>'startTime')::time; end_time:=(p_input->>'endTime')::time;
  if start_time is null or end_time is null or end_time<=start_time then raise exception 'Invalid interval' using errcode='22023'; end if;
 end if;
 if action='CREATE' then
  first_day:=(p_input->>'date')::date;
  last_day:=case when coalesce((p_input->>'repeat')::boolean,false) then (p_input->>'until')::date else first_day end;
  if first_day is null or last_day is null or first_day<(now() at time zone 'America/Recife')::date or last_day<first_day or last_day>first_day+365 then raise exception 'Invalid recurrence dates' using errcode='22023'; end if;
  select array_agg(distinct value::integer) into weekdays from jsonb_array_elements_text(p_input->'weekdays');
  if coalesce((p_input->>'repeat')::boolean,false) and (weekdays is null or cardinality(weekdays)=0 or not weekdays<@array[0,1,2,3,4,5,6]) then raise exception 'Invalid weekdays' using errcode='22023'; end if;
  if coalesce((p_input->>'repeat')::boolean,false) then series:=gen_random_uuid(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'starts_at',(d::date+start_time) at time zone 'America/Recife','ends_at',(d::date+end_time) at time zone 'America/Recife','active',true)),'[]'::jsonb) into proposed
  from generate_series(first_day::timestamp,last_day::timestamp,interval '1 day') d
  where (series is null or extract(dow from d)::integer=any(weekdays)) and (d::date+start_time) at time zone 'America/Recife'>now();
 elsif action<>'DELETE' then
  select jsonb_agg(jsonb_build_object('id',id,
   'starts_at',case when action='EDIT' then (((starts_at at time zone 'America/Recife')::date+start_time) at time zone 'America/Recife') else starts_at end,
   'ends_at',case when action='EDIT' then (((starts_at at time zone 'America/Recife')::date+end_time) at time zone 'America/Recife') else ends_at end,
   'active',case when action='PAUSE' then false when action='RESUME' then true else active end)) into proposed
  from public.teacher_availability where id=any(ids);
 end if;
 if action<>'DELETE' and (jsonb_array_length(proposed)=0 or exists(select 1 from jsonb_to_recordset(proposed) p(starts_at timestamptz) where starts_at<=now())) then
  return jsonb_build_object('ok',false,'code','PAST','message','Escolha um intervalo futuro. Nenhum horário foi alterado.','conflicts','[]'::jsonb);
 end if;
 -- Check the complete proposed set before writing anything: all-or-nothing.
 select coalesce(jsonb_agg(jsonb_build_object('date',(p.starts_at at time zone 'America/Recife')::date,'kind','overlap')),'[]'::jsonb) into conflicts
 from jsonb_to_recordset(proposed) p(id uuid,starts_at timestamptz,ends_at timestamptz,active boolean)
 where p.active and (exists(select 1 from public.teacher_availability a where a.teacher_id=teacher and a.active and not(a.id=any(ids)) and a.starts_at<p.ends_at and a.ends_at>p.starts_at)
 or exists(select 1 from jsonb_to_recordset(proposed) b(id uuid,starts_at timestamptz,ends_at timestamptz,active boolean) where b.active and b.id<>p.id and b.starts_at<p.ends_at and b.ends_at>p.starts_at));
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('ok',false,'code','OVERLAP','message','Há sobreposição nas datas indicadas. Ajuste os horários; nada foi salvo.','conflicts',conflicts); end if;
 if action<>'CREATE' then
  select coalesce(jsonb_agg(jsonb_build_object('date',(s.starts_at at time zone 'America/Recife')::date,'kind','session','sessionId',s.id,'title',s.title)),'[]'::jsonb) into conflicts
  from public.live_sessions s where s.teacher_id=teacher and s.status='SCHEDULED' and s.ends_at>now()
   and exists(select 1 from public.teacher_availability a where a.id=any(ids) and a.active and a.starts_at<=s.starts_at and a.ends_at>=s.ends_at)
   and not exists(select 1 from public.teacher_availability a where a.teacher_id=teacher and a.active and not(a.id=any(ids)) and a.starts_at<=s.starts_at and a.ends_at>=s.ends_at)
   and not exists(select 1 from jsonb_to_recordset(proposed) p(starts_at timestamptz,ends_at timestamptz,active boolean) where p.active and p.starts_at<=s.starts_at and p.ends_at>=s.ends_at);
  if jsonb_array_length(conflicts)>0 then return jsonb_build_object('ok',false,'code','DEPENDENCY','message','Há sessões agendadas que dependem destes horários. Resolva as sessões antes de alterar a disponibilidade.','conflicts',conflicts); end if;
 end if;
 if action='CREATE' then
  if series is not null then insert into public.teacher_availability_series(id,teacher_id,starts_on,ends_on,weekdays) values(series,teacher,first_day,last_day,weekdays); end if;
  insert into public.teacher_availability(id,teacher_id,starts_at,ends_at,active,series_id)
  select p.id,teacher,p.starts_at,p.ends_at,p.active,series from jsonb_to_recordset(proposed) p(id uuid,starts_at timestamptz,ends_at timestamptz,active boolean);
  count_rows:=jsonb_array_length(proposed);
 elsif action='DELETE' then
  delete from public.teacher_availability where id=any(ids); count_rows:=cardinality(ids);
 else
  update public.teacher_availability a set starts_at=p.starts_at,ends_at=p.ends_at,active=p.active
   from jsonb_to_recordset(proposed) p(id uuid,starts_at timestamptz,ends_at timestamptz,active boolean) where a.id=p.id;
  count_rows:=cardinality(ids);
 end if;
 result:=jsonb_build_object('ok',true,'count',count_rows);
 insert into public.teacher_availability_operations(teacher_id,operation_id,input,result) values(teacher,p_operation_id,p_input,result);
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'TEACHER_AVAILABILITY_BATCH_'||action,'teacher_availability',coalesce(series,target.id,p_operation_id),jsonb_build_object('operation_id',p_operation_id,'count',count_rows,'scope',scope));
 return result;
end $$;

-- Preserve public command signatures and existing authorization/booking behavior.
-- Fail closed if a previous definition differs: do not silently miss a reader/writer.
do $patch$
declare signature text; source text; updated text;
begin
 foreach signature in array array['public.manage_teacher_session(uuid,jsonb)','public.manage_teacher_availability(text,uuid,timestamptz,timestamptz)','public.get_teacher_session_workspace(timestamptz,timestamptz,uuid)','public.get_teacher_operation_context()'] loop
  source:=pg_get_functiondef(signature::regprocedure); updated:=source;
  if signature like 'public.manage_teacher_session%' then
   updated:=replace(updated,'where teacher_id=teacher and starts_at<=starts and ends_at>=ends','where teacher_id=teacher and active and starts_at<=starts and ends_at>=ends');
  elsif signature like 'public.manage_teacher_availability%' then
   updated:=replace(updated,'a.teacher_id=teacher and a.id<>p_id','a.teacher_id=teacher and a.active and a.id<>p_id');
   updated:=replace(updated,'where teacher_id=teacher and id is distinct from p_id','where teacher_id=teacher and active and id is distinct from p_id');
  else
   updated:=replace(updated,'where a.teacher_id=teacher','where a.teacher_id=teacher and a.active');
  end if;
  if source=updated then raise exception 'Availability patch contract changed: %',signature; end if;
  execute updated;
 end loop;
end $patch$;

revoke all on function public.teacher_availability_workspace(timestamptz,timestamptz),public.mutate_teacher_availability(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.teacher_availability_workspace(timestamptz,timestamptz),public.mutate_teacher_availability(uuid,jsonb) to authenticated;
