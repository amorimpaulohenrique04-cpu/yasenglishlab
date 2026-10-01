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

create or replace function public.book_live_session(p_live_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_booking public.session_bookings%rowtype;
  created_booking_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.has_role('STUDENT', false) then
    raise exception 'student role required' using errcode = '42501';
  end if;

  -- Serialize both duplicate retries and competing users on the same session.
  -- Business validation remains in private.validate_booking(), which runs on INSERT.
  perform 1
  from public.live_sessions s
  where s.id = p_live_session_id
  for update;

  if not found then
    raise exception 'live session not found' using errcode = '23503';
  end if;

  select b.*
    into existing_booking
  from public.session_bookings b
  where b.live_session_id = p_live_session_id
    and b.user_id = current_user_id;

  if found then
    if existing_booking.status = 'BOOKED' then
      return existing_booking.id;
    end if;

    -- Rebooking after cancellation is intentionally not invented in Agenda V1.
    raise exception 'existing booking is not active' using errcode = '23514';
  end if;

  insert into public.session_bookings (
    live_session_id,
    user_id,
    status
  )
  values (
    p_live_session_id,
    current_user_id,
    'BOOKED'
  )
  returning id into created_booking_id;

  return created_booking_id;
end;
$$;

revoke all on function public.get_agenda_sessions() from public, anon;
revoke all on function public.book_live_session(uuid) from public, anon;

grant execute on function public.get_agenda_sessions() to authenticated;
grant execute on function public.book_live_session(uuid) to authenticated;
