-- PROMPT 17 — Teacher Operations V1
-- Adds explicit Teacher-scoped read models and an atomic attendance + audit boundary.
-- Existing role, MFA, assignment and table RLS contracts remain authoritative.

create or replace function public.get_teacher_sessions()
returns table (
  live_session_id uuid,
  session_type text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  session_status text,
  participant_count bigint,
  attendance_marked_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_teacher_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.has_role('TEACHER', true) then
    raise exception 'teacher role with aal2 required' using errcode = '42501';
  end if;

  select t.id
    into current_teacher_id
  from public.teachers t
  where t.user_id = current_user_id
    and t.active
  limit 1;

  if current_teacher_id is null then
    raise exception 'active teacher record required' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.session_type,
    s.title,
    s.starts_at,
    s.ends_at,
    s.status,
    count(b.id) filter (where b.status = 'BOOKED') as participant_count,
    count(a.id) filter (where b.status = 'BOOKED') as attendance_marked_count
  from public.live_sessions s
  left join public.session_bookings b
    on b.live_session_id = s.id
  left join public.attendance a
    on a.session_booking_id = b.id
  where s.teacher_id = current_teacher_id
  group by
    s.id,
    s.session_type,
    s.title,
    s.starts_at,
    s.ends_at,
    s.status
  order by s.starts_at desc, s.id;
end;
$$;

create or replace function public.get_teacher_session_roster(p_live_session_id uuid)
returns table (
  session_booking_id uuid,
  display_name text,
  booking_status text,
  attendance_id uuid,
  attendance_status text,
  attendance_marked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_teacher_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.has_role('TEACHER', true) then
    raise exception 'teacher role with aal2 required' using errcode = '42501';
  end if;

  select t.id
    into current_teacher_id
  from public.teachers t
  where t.user_id = current_user_id
    and t.active
  limit 1;

  if current_teacher_id is null
    or not exists (
      select 1
      from public.live_sessions s
      where s.id = p_live_session_id
        and s.teacher_id = current_teacher_id
    ) then
    raise exception 'teacher session unavailable' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    p.display_name,
    b.status,
    a.id,
    a.status,
    a.marked_at
  from public.session_bookings b
  join public.profiles p
    on p.user_id = b.user_id
  left join public.attendance a
    on a.session_booking_id = b.id
  where b.live_session_id = p_live_session_id
  order by p.display_name, b.id;
end;
$$;

create or replace function private.audit_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  related_session_id uuid;
begin
  select b.live_session_id
    into related_session_id
  from public.session_bookings b
  where b.id = new.session_booking_id;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    data
  )
  values (
    auth.uid(),
    'attendance_marked',
    'attendance',
    new.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'live_session_id', related_session_id,
        'session_booking_id', new.session_booking_id,
        'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
        'new_status', new.status
      )
    )
  );

  return new;
end;
$$;

revoke all on function private.audit_attendance_change() from public, anon, authenticated;

create trigger attendance_audit
after insert or update on public.attendance
for each row execute function private.audit_attendance_change();

create or replace function public.mark_teacher_attendance(
  p_session_booking_id uuid,
  p_status text
)
returns table (
  attendance_id uuid,
  attendance_status text,
  attendance_marked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_booking public.session_bookings%rowtype;
  target_teacher_id uuid;
  persisted public.attendance%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.has_role('TEACHER', true) then
    raise exception 'teacher role with aal2 required' using errcode = '42501';
  end if;

  if p_status not in ('ATTENDED', 'NO_SHOW') then
    raise exception 'unsupported attendance status' using errcode = '23514';
  end if;

  select b.*
    into target_booking
  from public.session_bookings b
  where b.id = p_session_booking_id
  for update;

  if not found or target_booking.status <> 'BOOKED' then
    raise exception 'attendance requires an active booked participant' using errcode = '23514';
  end if;

  select t.id
    into target_teacher_id
  from public.live_sessions s
  join public.teachers t
    on t.id = s.teacher_id
  where s.id = target_booking.live_session_id
    and t.user_id = current_user_id
    and t.active
  limit 1;

  if target_teacher_id is null then
    raise exception 'booking is outside teacher scope' using errcode = '42501';
  end if;

  insert into public.attendance (
    session_booking_id,
    status,
    marked_at,
    marked_by_user_id
  )
  values (
    p_session_booking_id,
    p_status,
    now(),
    current_user_id
  )
  on conflict (session_booking_id)
  do update set
    status = excluded.status,
    marked_at = excluded.marked_at,
    marked_by_user_id = excluded.marked_by_user_id
  returning * into persisted;

  return query
  select persisted.id, persisted.status, persisted.marked_at;
end;
$$;

revoke all on function public.get_teacher_sessions() from public, anon, authenticated;
revoke all on function public.get_teacher_session_roster(uuid) from public, anon, authenticated;
revoke all on function public.mark_teacher_attendance(uuid, text) from public, anon, authenticated;

grant execute on function public.get_teacher_sessions() to authenticated;
grant execute on function public.get_teacher_session_roster(uuid) to authenticated;
grant execute on function public.mark_teacher_attendance(uuid, text) to authenticated;
