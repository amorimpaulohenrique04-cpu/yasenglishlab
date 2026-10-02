-- P21.4 follow-up: keep an own BOOKED session reachable from Agenda for the
-- same grace period enforced by get_live_session_join_access().
--
-- Future sessions keep their existing discovery behavior. Once a session starts,
-- only the Student's own active booking keeps it in the Agenda projection, and
-- only until the configured Join grace window closes.
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
  ),
  join_policy as (
    select after_end_seconds
    from private.live_join_policy
    where id
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
  cross join current_user_context
  cross join join_policy
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
    and (
      s.starts_at >= now()
      or (
        own_booking.status = 'BOOKED'
        and s.status = 'SCHEDULED'
        and s.ends_at + make_interval(secs => join_policy.after_end_seconds) >= now()
      )
    )
    and (
      private.can_book_session(s.id, current_user_context.user_id)
      or own_booking.id is not null
    )
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
