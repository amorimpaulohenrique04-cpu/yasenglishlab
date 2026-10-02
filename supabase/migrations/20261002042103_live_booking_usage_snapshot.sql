-- P21.2: booking facts, not a mutable quota counter.
alter table public.session_bookings
  add column entitlement_key_used text,
  add column plan_entitlement_id_used uuid references public.plan_entitlements(id) on delete restrict,
  add column usage_cadence text check (usage_cadence in ('WEEK','MONTH','NONE')),
  add column usage_limit numeric(10,2),
  add column usage_session_starts_at timestamptz,
  add column usage_window_start timestamptz,
  add column usage_window_end timestamptz,
  add column usage_timezone text,
  add column usage_resolved_at timestamptz,
  add column usage_provenance text not null default 'LEGACY_UNRESOLVED'
    check (usage_provenance in ('COMMAND','LEGACY_RESOLVED','LEGACY_UNRESOLVED'));

create or replace function private.booking_usage_window(p_starts_at timestamptz, p_cadence text)
returns table(window_start timestamptz, window_end timestamptz)
language sql immutable set search_path = '' as $$
  select
    case when p_cadence = 'NONE' then null else
      date_trunc(case when p_cadence = 'WEEK' then 'week' else 'month' end,
        p_starts_at at time zone 'America/Recife') at time zone 'America/Recife' end,
    case when p_cadence = 'NONE' then null else
      (date_trunc(case when p_cadence = 'WEEK' then 'week' else 'month' end,
        p_starts_at at time zone 'America/Recife') +
        case when p_cadence = 'WEEK' then interval '1 week' else interval '1 month' end)
        at time zone 'America/Recife' end;
$$;

create or replace function private.booking_entitlement(p_user uuid, p_key text, p_at timestamptz)
returns table(config_id uuid, limit_value numeric, cadence text)
language sql stable security definer set search_path = '' as $$
  select pe.id, pe.limit_value, pe.cadence
  from public.subscriptions s
  join public.plan_entitlements pe on pe.plan_id = s.plan_id
  join public.entitlements e on e.id = pe.entitlement_id
  where s.user_id = p_user and s.status in ('TRIALING','ACTIVE')
    and (s.current_period_start is null or s.current_period_start <= p_at)
    and (s.current_period_end is null or s.current_period_end > p_at)
    and e.key = p_key and e.active
    and pe.effective_from <= p_at and (pe.effective_to is null or pe.effective_to > p_at)
  order by s.started_at desc, pe.effective_from desc limit 1;
$$;

-- Preserve existing facts; do not label current configuration as historical.
update public.session_bookings b set
  entitlement_key_used = s.required_entitlement_key,
  usage_session_starts_at = s.starts_at,
  usage_timezone = 'America/Recife', usage_resolved_at = b.booked_at
from public.live_sessions s where s.id = b.live_session_id;

update public.session_bookings b set
  plan_entitlement_id_used = resolved.config_id, usage_limit = resolved.limit_value,
  usage_cadence = resolved.cadence, usage_window_start = resolved.window_start,
  usage_window_end = resolved.window_end, usage_provenance = 'LEGACY_RESOLVED'
from (
  select b0.id, e.*, w.* from public.session_bookings b0
  cross join lateral private.booking_entitlement(b0.user_id, b0.entitlement_key_used, b0.booked_at) e
  cross join lateral private.booking_usage_window(b0.usage_session_starts_at, e.cadence) w
) resolved where resolved.id = b.id;

-- Ambiguous cancellations require explicit reconciliation, never an assumed refund.
do $$ begin
  if exists (select 1 from public.session_bookings where status = 'CANCELLED' and cancelled_at is null) then
    raise exception 'Reconcile legacy CANCELLED bookings with missing cancelled_at before quota migration';
  end if;
end $$;

create index session_bookings_usage_idx on public.session_bookings(user_id, entitlement_key_used, usage_session_starts_at);
create index session_bookings_entitlement_snapshot_idx on public.session_bookings(plan_entitlement_id_used) where plan_entitlement_id_used is not null;
alter table public.session_bookings add constraint booking_usage_window_valid
  check ((usage_window_start is null and usage_window_end is null) or usage_window_end > usage_window_start);
revoke all on function private.booking_usage_window(timestamptz,text) from public, anon, authenticated;
revoke all on function private.booking_entitlement(uuid,text,timestamptz) from public, anon, authenticated;

-- Preserve the public booking projection without exposing commercial configuration snapshots.
revoke select on public.session_bookings from authenticated;
grant select(id,live_session_id,user_id,status,booked_at,cancelled_at,created_at,updated_at)
  on public.session_bookings to authenticated;
