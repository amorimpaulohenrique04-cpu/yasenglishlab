-- Stage 05a: read-only operational visibility of Billing for ADMIN (aal2).
-- Additive. Three security definer projections; no replay/reprocessing, no table grants,
-- no change to reconcile_billing_event or the paid-access gate.
-- Never exposed: billing_events.payload / provider event_id, checkout provider ids, amounts,
-- notification recipients/e-mail/title/body, notification_deliveries idempotency/provider ids.
--
-- Known limitation: reconcile_billing_event does not persist the STALE outcome (a stale event is
-- stored with processing_error NULL, indistinguishable from APPLIED), so STALE is not derivable here.

-- Supporting partial indexes for the recency-ordered attention lists.
create index billing_events_attention_idx on public.billing_events (occurred_at desc, id desc)
  where processing_error is not null or event_type = 'IGNORED';
create index billing_checkout_sessions_open_idx on public.billing_checkout_sessions (created_at desc, id desc)
  where status in ('CREATING', 'READY');
create index notification_deliveries_attention_idx on public.notification_deliveries (created_at desc, id desc)
  where status in ('PENDING', 'FAILED');

create function public.admin_billing_rejected_events(
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  outcome text,
  event_type text,
  processing_error text,
  occurred_at timestamptz,
  processed_at timestamptz,
  subscription_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if (p_status is not null and p_status not in ('REJECTED', 'IGNORED'))
     or p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid status or paging input' using errcode = '22023';
  end if;

  return query
  select e.id,
    case when e.processing_error is not null then 'REJECTED' else 'IGNORED' end,
    left(e.event_type, 64),
    -- Reconciliation writes an allowlisted code; anything else is masked, never echoed.
    case when e.processing_error is null then null
      when e.processing_error in ('SUBSCRIPTION_LINK_MISSING', 'LINK_CONFLICT', 'SUBSCRIPTION_NOT_FOUND',
        'CHECKOUT_NOT_FOUND', 'CURRENCY_MISMATCH', 'AMOUNT_MISMATCH', 'PAYMENT_DATA_MISSING',
        'INITIAL_PAYMENT_NOT_CONFIRMED', 'SUBSCRIPTION_CANCELLED', 'EXPIRED_CYCLE',
        'CURRENT_SUBSCRIPTION_CONFLICT', 'STATE_CONFLICT') then e.processing_error
      else 'STATE_CONFLICT' end,
    e.occurred_at,
    e.processed_at,
    e.subscription_id
  from public.billing_events e
  where e.provider = 'ASAAS'
    and (e.processing_error is not null or e.event_type = 'IGNORED')
    and (p_status is null
      or (p_status = 'REJECTED' and e.processing_error is not null)
      or (p_status = 'IGNORED' and e.processing_error is null))
  order by e.occurred_at desc, e.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.admin_billing_stuck_checkouts(
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  stuck_reason text,
  plan_code text,
  user_id uuid,
  display_name text,
  has_subscription boolean,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid paging input' using errcode = '22023';
  end if;

  return query
  select c.id,
    c.status,
    case c.status when 'CREATING' then 'CREATING_TIMEOUT' else 'READY_PAST_EXPIRY' end,
    pl.code,
    c.user_id,
    pr.display_name,
    exists (select 1 from public.subscriptions s where s.billing_checkout_session_id = c.id),
    c.created_at,
    c.expires_at
  from public.billing_checkout_sessions c
  join public.plans pl on pl.id = c.plan_id
  left join public.profiles pr on pr.user_id = c.user_id
  where (c.status = 'CREATING' and c.created_at <= now() - interval '60 minutes')
     or (c.status = 'READY' and c.expires_at <= now())
  order by c.created_at desc, c.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.admin_notification_failures(
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  notification_type text,
  attempt_count integer,
  last_error_code text,
  next_attempt_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if (p_status is not null and p_status not in ('FAILED', 'PENDING'))
     or p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid status or paging input' using errcode = '22023';
  end if;

  return query
  select d.id,
    d.status,
    n.notification_type,
    d.attempt_count,
    d.last_error_code,
    d.next_attempt_at,
    d.created_at,
    d.updated_at
  from public.notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  where (p_status is null or d.status = p_status)
    -- FAILED is terminal; PENDING only counts once overdue (retry backoff tops out at 8 minutes).
    and (d.status = 'FAILED'
      or (d.status = 'PENDING' and coalesce(d.next_attempt_at, d.created_at) <= now() - interval '15 minutes'))
  order by d.created_at desc, d.id desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_billing_rejected_events(text, integer, integer),
  public.admin_billing_stuck_checkouts(integer, integer),
  public.admin_notification_failures(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_billing_rejected_events(text, integer, integer),
  public.admin_billing_stuck_checkouts(integer, integer),
  public.admin_notification_failures(text, integer, integer)
  to authenticated;
