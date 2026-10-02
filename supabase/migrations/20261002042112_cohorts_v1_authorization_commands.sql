create or replace function private.is_cohort_teacher(p_cohort uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.has_role('TEACHER',true) and exists(
  select 1 from public.cohort_teachers ct join public.teachers t on t.id=ct.teacher_id
   join public.cohorts c on c.id=ct.cohort_id
  where ct.cohort_id=p_cohort and t.user_id=auth.uid() and t.active and c.status='ACTIVE'
   and ct.starts_at<=now() and (ct.ends_at is null or ct.ends_at>now()));
$$;
create or replace function private.has_cohort_membership(p_cohort uuid,p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.cohort_memberships m join public.cohorts c on c.id=m.cohort_id
  join public.enrollments e on e.id=m.enrollment_id
  where m.cohort_id=p_cohort and m.user_id=p_user and m.status='ACTIVE' and c.status='ACTIVE'
   and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now()) and e.status='ACTIVE'
   and exists(select 1 from public.user_roles ur where ur.user_id=p_user and ur.role='STUDENT'));
$$;
create or replace function private.can_read_cohort(p_cohort uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.has_role('ADMIN',true) or private.is_cohort_teacher(p_cohort) or
 (private.has_role('STUDENT',false) and exists(select 1 from public.cohort_memberships where cohort_id=p_cohort and user_id=auth.uid()));
$$;
create or replace function private.can_book_session(p_session uuid,p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select (auth.uid() is null or p_user=auth.uid()) and exists(select 1 from public.live_sessions s where s.id=p_session and
  (s.cohort_id is null or private.has_cohort_membership(s.cohort_id,p_user)));
$$;
create or replace function private.is_teacher_assigned(p_student_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.has_role('TEACHER',true) and (
  exists(select 1 from public.teachers t join public.teacher_student_assignments a on a.teacher_id=t.id
   where t.user_id=auth.uid() and t.active and a.student_user_id=p_student_user_id
    and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now()))
  or exists(select 1 from public.cohort_memberships m
   where m.user_id=p_student_user_id and private.has_cohort_membership(m.cohort_id,p_student_user_id)
    and private.is_cohort_teacher(m.cohort_id)));
$$;

create policy cohorts_read on public.cohorts for select to authenticated using(private.can_read_cohort(id));
create policy memberships_read on public.cohort_memberships for select to authenticated using(
 (private.has_role('STUDENT',false) and user_id=auth.uid())
 or (status='ACTIVE' and starts_at<=now() and (ends_at is null or ends_at>now()) and private.is_cohort_teacher(cohort_id))
 or private.has_role('ADMIN',true));
create policy cohort_teachers_read on public.cohort_teachers for select to authenticated using(
 private.is_cohort_teacher(cohort_id) or private.has_role('ADMIN',true));
grant select on public.cohorts,public.cohort_memberships,public.cohort_teachers to authenticated;

drop policy live_sessions_authenticated_select on public.live_sessions;
create policy live_sessions_authenticated_select on public.live_sessions for select to authenticated using(
 (status in ('SCHEDULED','COMPLETED') and cohort_id is null)
 or (private.has_role('STUDENT',false) and private.can_book_session(id,auth.uid()))
 or private.is_teacher_for_session(id) or private.is_cohort_teacher(cohort_id)
 or private.has_role('SUPPORT',true) or private.has_role('ADMIN',true)
 or exists(select 1 from public.session_bookings b where b.live_session_id=live_sessions.id and b.user_id=auth.uid()));

create or replace function private.validate_cohort_relation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_table_name='cohorts' then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
   raise exception 'invalid cohort timezone' using errcode='23514';
  end if;
  if tg_op='UPDATE' and row(new.course_id,new.timezone,new.starts_at,new.ends_at) is distinct from row(old.course_id,old.timezone,old.starts_at,old.ends_at)
   and (exists(select 1 from public.live_sessions where cohort_id=old.id) or exists(select 1 from public.cohort_memberships where cohort_id=old.id)) then
   raise exception 'cohort structural metadata has active dependencies' using errcode='23514';
  end if;
 elsif tg_table_name='cohort_memberships' then
  if tg_op='UPDATE' and row(new.cohort_id,new.user_id,new.enrollment_id,new.starts_at) is distinct from row(old.cohort_id,old.user_id,old.enrollment_id,old.starts_at) then
   raise exception 'membership identity is immutable' using errcode='23514';
  end if;
  if new.status='ACTIVE' and not exists(select 1 from public.enrollments e join public.cohorts c on c.course_id=e.course_id
    join public.user_roles ur on ur.user_id=e.user_id and ur.role='STUDENT'
    where c.id=new.cohort_id and c.status<>'ARCHIVED' and e.id=new.enrollment_id and e.user_id=new.user_id and e.status='ACTIVE') then
   raise exception 'active compatible enrollment and STUDENT role required' using errcode='23514';
  end if;
 elsif tg_table_name='cohort_teachers' then
  if not exists(select 1 from public.teachers t join public.user_roles ur on ur.user_id=t.user_id and ur.role='TEACHER' where t.id=new.teacher_id and t.active) then
   raise exception 'active Teacher required' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger cohort_contract before insert or update on public.cohorts for each row execute function private.validate_cohort_relation();
create trigger membership_contract before insert or update on public.cohort_memberships for each row execute function private.validate_cohort_relation();
create trigger cohort_teacher_contract before insert or update on public.cohort_teachers for each row execute function private.validate_cohort_relation();

create or replace function private.protect_reserved_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and row(new.starts_at,new.required_entitlement_key,new.teacher_id,new.cohort_id) is distinct from row(old.starts_at,old.required_entitlement_key,old.teacher_id,old.cohort_id)
  and exists(select 1 from public.session_bookings where live_session_id=old.id) then
  raise exception 'reserved session identity and usage schedule are immutable' using errcode='23514';
 end if;
 if new.cohort_id is not null and not exists(
  select 1 from public.cohorts c join public.cohort_teachers ct on ct.cohort_id=c.id
  where c.id=new.cohort_id and c.status<>'ARCHIVED' and ct.teacher_id=new.teacher_id
   and ct.ends_at is null and new.starts_at>=c.starts_at and (c.ends_at is null or new.ends_at<=c.ends_at))
  and (tg_op='INSERT' or new.cohort_id is distinct from old.cohort_id or new.teacher_id is distinct from old.teacher_id or new.starts_at is distinct from old.starts_at) then
  raise exception 'session requires compatible cohort Teacher and period' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger reserved_session_guard on public.live_sessions;
create trigger reserved_session_guard before insert or update on public.live_sessions for each row execute function private.protect_reserved_session();

create or replace function public.manage_cohort(p_operation text,p_cohort_id uuid,p_input jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid:=p_cohort_id; linked_enrollment uuid;
begin
 if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN with aal2 required' using errcode='42501'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'cohort input must be object' using errcode='23514'; end if;
 if p_operation='CREATE' then
  insert into public.cohorts(course_id,name,code,timezone,starts_at,ends_at) values(
   (p_input->>'course_id')::uuid,p_input->>'name',p_input->>'code',coalesce(p_input->>'timezone','America/Recife'),
   case when length(p_input->>'starts_at')=10 then (p_input->>'starts_at')::timestamp at time zone coalesce(p_input->>'timezone','America/Recife') else (p_input->>'starts_at')::timestamptz end,
   case when length(p_input->>'ends_at')=10 then (p_input->>'ends_at')::timestamp at time zone coalesce(p_input->>'timezone','America/Recife') else (p_input->>'ends_at')::timestamptz end) returning id into target;
 else
  perform 1 from public.cohorts where id=target for update;
  if not found then raise exception 'cohort not found' using errcode='23503'; end if;
  case p_operation
  when 'EDIT' then update public.cohorts set name=coalesce(p_input->>'name',name),timezone=coalesce(p_input->>'timezone',timezone) where id=target;
  when 'STATUS' then update public.cohorts set status=p_input->>'status' where id=target;
  when 'ADD_STUDENT' then
   select e.id into linked_enrollment from public.enrollments e join public.cohorts c on c.course_id=e.course_id
    where c.id=target and e.user_id=(p_input->>'user_id')::uuid and e.status='ACTIVE' order by e.created_at desc limit 1;
   if linked_enrollment is null then raise exception 'active compatible enrollment required' using errcode='23514'; end if;
   insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(target,(p_input->>'user_id')::uuid,linked_enrollment)
    on conflict(cohort_id,user_id) where status='ACTIVE' do nothing;
  when 'REMOVE_STUDENT' then update public.cohort_memberships set status='LEFT',ends_at=clock_timestamp()
    where cohort_id=target and user_id=(p_input->>'user_id')::uuid and status='ACTIVE';
  when 'ADD_TEACHER' then insert into public.cohort_teachers(cohort_id,teacher_id,is_primary)
    values(target,(p_input->>'teacher_id')::uuid,coalesce((p_input->>'is_primary')::boolean,false))
    on conflict(cohort_id,teacher_id) where ends_at is null do nothing;
  when 'REMOVE_TEACHER' then update public.cohort_teachers set ends_at=clock_timestamp()
    where cohort_id=target and teacher_id=(p_input->>'teacher_id')::uuid and ends_at is null;
  else raise exception 'unsupported cohort operation' using errcode='23514';
  end case;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
  values(auth.uid(),'cohort_'||lower(p_operation),'cohort',target,jsonb_build_object('operation',p_operation));
 return target;
end $$;
revoke all on function private.is_cohort_teacher(uuid),private.has_cohort_membership(uuid,uuid),
 private.can_read_cohort(uuid),private.validate_cohort_relation() from public,anon,authenticated;
grant execute on function private.is_cohort_teacher(uuid),private.can_read_cohort(uuid),private.can_book_session(uuid,uuid) to authenticated;
revoke all on function public.manage_cohort(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manage_cohort(text,uuid,jsonb) to authenticated;
-- Prompt 16 — Agenda V1 / Live Session Booking
-- Adds only a safe aggregate read model and an authenticated booking RPC.
-- Existing tables, RLS, audit trigger and private.validate_booking() remain authoritative.

create or replace function public.get_agenda_sessions()
returns table (
  live_session_id uuid,
  session_type text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  session_status text,
  required_entitlement_key text,
  booked_count bigint,
  spots_remaining integer,
  own_booking_id uuid,
  own_booking_status text,
  has_required_entitlement boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_user_context as (
    select auth.uid() as user_id
  )
  select
    s.id as live_session_id,
    s.session_type,
    s.title,
    s.starts_at,
    s.ends_at,
    s.capacity,
    s.status as session_status,
    s.required_entitlement_key,
    count(b.id) filter (where b.status = 'BOOKED') as booked_count,
    greatest(
      s.capacity::integer - (count(b.id) filter (where b.status = 'BOOKED'))::integer,
      0
    ) as spots_remaining,
    own_booking.id as own_booking_id,
    own_booking.status as own_booking_status,
    case
      when s.required_entitlement_key is null then true
      else private.current_user_has_entitlement(s.required_entitlement_key)
    end as has_required_entitlement
  from public.live_sessions s
  cross join current_user_context current_user_context
  left join public.session_bookings b
    on b.live_session_id = s.id
  left join lateral (
    select own.id, own.status
    from public.session_bookings own
    where own.live_session_id = s.id
      and own.user_id = current_user_context.user_id
    limit 1
  ) own_booking on true
  where current_user_context.user_id is not null
    and private.has_role('STUDENT', false)
    and s.starts_at >= now()
    and (private.can_book_session(s.id, current_user_context.user_id) or own_booking.id is not null)
    and (
      s.status = 'SCHEDULED'
      or own_booking.id is not null
    )
  group by
    s.id,
    s.session_type,
    s.title,
    s.starts_at,
    s.ends_at,
    s.capacity,
    s.status,
    s.required_entitlement_key,
    own_booking.id,
    own_booking.status
  order by s.starts_at, s.id;
$$;



-- Safe V2 eligibility also reflects removed membership while retaining own booking history.
create or replace function public.get_agenda_sessions_v2()
returns setof jsonb language sql volatile security definer set search_path = '' as $$
 select to_jsonb(s) || jsonb_build_object(
  'quota',private.booking_quota(auth.uid(),s.required_entitlement_key,s.starts_at),
  'cohort_allowed',private.can_book_session(s.live_session_id,auth.uid()))
 from public.get_agenda_sessions() s;
$$;
