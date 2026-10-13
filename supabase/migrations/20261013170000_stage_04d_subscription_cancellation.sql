-- Stage 04d (ADR 0016): Student-initiated cancellation with access until the end of the PAID cycle.
--
-- Additive only. No new column: the existing subscriptions.current_period_end carries "paid access until"
-- and cancel_at_period_end carries the request marker while the subscription is still ACTIVE.
--
-- Why current_period_end (and not cancel_at_period_end) is the durable fact: reconcile_billing_event, on the
-- provider's SUBSCRIPTION_DELETED (effect CANCELLED), sets status='CANCELLED', ended_at=now() and
-- cancel_at_period_end=false but never writes current_period_start/current_period_end (nothing in Billing
-- core does). So the marker is reset by the webhook, while current_period_end survives it. It also stays
-- consistent with the entitlement contract, which already reads "current_period_end > p_at".
--
-- Flow: request (marker + end date) -> server cancels the Asaas subscription (no renewal) ->
-- webhook moves status to CANCELLED -> access holds until current_period_end, then ADR 0016 suspension.
-- If the provider call fails the server calls revert_subscription_cancellation_request().

-- Paid access now also covers a CANCELLED subscription whose paid cycle has not ended yet.
-- PAST_DUE/EXPIRED stay suspended; staff and users without any subscription stay exempt. Same signature/grants.
create or replace function private.has_paid_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_user and ur.role in ('ADMIN', 'TEACHER', 'SUPPORT')
    )
    or not exists (select 1 from public.subscriptions s where s.user_id = p_user)
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user
        and (
          s.status in ('ACTIVE', 'TRIALING')
          or (s.status = 'CANCELLED' and s.current_period_end is not null and s.current_period_end > now())
        )
    )
  );
$$;
revoke all on function private.has_paid_access(uuid) from public, anon, authenticated;

-- Entitlements follow the same rule, otherwise a cancelled-but-paid Student would keep keyless content but
-- lose entitled content/bookings. A CANCELLED row needs an explicit future end (null never grants).
create or replace function private.entitlement_limit(
  p_user_id uuid,
  p_entitlement_key text,
  p_at timestamptz default now()
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select pe.limit_value
  from public.subscriptions s
  join public.plan_entitlements pe on pe.plan_id = s.plan_id
  join public.entitlements e on e.id = pe.entitlement_id
  where s.user_id = p_user_id
    and (
      s.status in ('TRIALING', 'ACTIVE')
      or (s.status = 'CANCELLED' and s.current_period_end is not null)
    )
    and (s.current_period_start is null or s.current_period_start <= p_at)
    and (s.current_period_end is null or s.current_period_end > p_at)
    and e.key = p_entitlement_key
    and e.active
    and pe.effective_from <= p_at
    and (pe.effective_to is null or pe.effective_to > p_at)
  order by s.started_at desc, pe.effective_from desc
  limit 1;
$$;

create or replace function private.booking_entitlement(p_user uuid, p_key text, p_at timestamptz)
returns table(config_id uuid, limit_value numeric, cadence text)
language sql stable security definer set search_path = '' as $$
  select pe.id, pe.limit_value, pe.cadence
  from public.subscriptions s
  join public.plan_entitlements pe on pe.plan_id = s.plan_id
  join public.entitlements e on e.id = pe.entitlement_id
  where s.user_id = p_user
    and (
      s.status in ('TRIALING','ACTIVE')
      or (s.status = 'CANCELLED' and s.current_period_end is not null)
    )
    and (s.current_period_start is null or s.current_period_start <= p_at)
    and (s.current_period_end is null or s.current_period_end > p_at)
    and e.key = p_key and e.active
    and pe.effective_from <= p_at and (pe.effective_to is null or pe.effective_to > p_at)
  order by s.started_at desc, pe.effective_from desc limit 1;
$$;
revoke all on function private.booking_entitlement(uuid,text,timestamptz) from public, anon, authenticated;

-- Student asks to cancel THEIR OWN ACTIVE subscription. The server then cancels the provider subscription.
-- Paid access ends at the next due date: billing_last_cycle_date (dueDate of the last paid cycle) + 1 month,
-- midnight America/Recife, never earlier than now. Without a recorded cycle there is no evidence of prepaid
-- time, so access ends now. Idempotent: repeating (or retrying after the webhook) never moves the date.
create function public.request_subscription_cancellation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sub public.subscriptions;
  paid_until timestamptz;
begin
  if uid is null or not private.has_role('STUDENT', false) then
    raise exception 'Student required' using errcode = '42501';
  end if;
  -- Same per-user lock as reconcile_billing_event / checkout reservation; lock, then row, in that order.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 3103));

  select * into sub from public.subscriptions
  where user_id = uid and status = 'ACTIVE'
  order by created_at desc limit 1
  for update;

  if sub.id is null then
    -- Retry after the provider webhook already moved the row: report the same fact, change nothing.
    select * into sub from public.subscriptions
    where user_id = uid and status = 'CANCELLED' and current_period_end is not null and current_period_end > now()
    order by current_period_end desc limit 1;
    if sub.id is not null then
      return jsonb_build_object('subscription_id', sub.id, 'provider_subscription_id', sub.provider_subscription_id,
        'access_until', sub.current_period_end, 'status', sub.status, 'already_requested', true);
    end if;
    raise exception 'ACTIVE_SUBSCRIPTION_REQUIRED' using errcode = 'P0002';
  end if;

  if sub.cancel_at_period_end and sub.current_period_end is not null then
    return jsonb_build_object('subscription_id', sub.id, 'provider_subscription_id', sub.provider_subscription_id,
      'access_until', sub.current_period_end, 'status', sub.status, 'already_requested', true);
  end if;

  paid_until := greatest(
    coalesce((sub.billing_last_cycle_date + interval '1 month')::timestamp at time zone 'America/Recife', clock_timestamp()),
    clock_timestamp()
  );
  update public.subscriptions set cancel_at_period_end = true, current_period_end = paid_until where id = sub.id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (uid, 'subscription_cancellation_requested', 'subscription', sub.id,
    jsonb_build_object('access_until', paid_until, 'provider', sub.provider));

  return jsonb_build_object('subscription_id', sub.id, 'provider_subscription_id', sub.provider_subscription_id,
    'access_until', paid_until, 'status', sub.status, 'already_requested', false);
end;
$$;
revoke all on function public.request_subscription_cancellation() from public, anon, authenticated;
grant execute on function public.request_subscription_cancellation() to authenticated;

-- Undo the marker when the provider call failed. Only while still ACTIVE: once the webhook made the row
-- CANCELLED the cancellation is a provider fact and is not revertible here. Idempotent.
-- current_period_end is cleared back to null: nothing else in the system writes it (see header), so null is
-- the exact pre-request value.
create function public.revert_subscription_cancellation_request()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sub public.subscriptions;
begin
  if uid is null or not private.has_role('STUDENT', false) then
    raise exception 'Student required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 3103));

  select * into sub from public.subscriptions
  where user_id = uid and status = 'ACTIVE' and cancel_at_period_end
  order by created_at desc limit 1
  for update;

  if sub.id is null then
    return jsonb_build_object('reverted', false);
  end if;

  update public.subscriptions set cancel_at_period_end = false, current_period_end = null where id = sub.id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (uid, 'subscription_cancellation_reverted', 'subscription', sub.id, jsonb_build_object('provider', sub.provider));

  return jsonb_build_object('reverted', true, 'subscription_id', sub.id);
end;
$$;
revoke all on function public.revert_subscription_cancellation_request() from public, anon, authenticated;
grant execute on function public.revert_subscription_cancellation_request() to authenticated;
