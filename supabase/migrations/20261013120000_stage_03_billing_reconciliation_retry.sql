-- Stage 03 billing reconciliation robustness (additive; applied migrations untouched).
--
-- Problem: reconcile_billing_event stored CHECKOUT_NOT_FOUND as an immutable REJECTED
-- event. A payment webhook that carries only the provider checkout id can arrive
-- before complete_billing_checkout links it; redelivery of the same eventId/payload
-- then returned DUPLICATE and the payment was never applied.
--
-- Decision (retry signal): RAISE instead of returning a value or inserting a row.
--   * SQLSTATE 'PT503' (PostgREST maps the PTnnn class to HTTP nnn), message
--     'BILLING_EVENT_RETRY', detail 'CHECKOUT_NOT_LINKED'. supabase-js: error.code='PT503'.
--   * Raised outside the domain subtransaction, so the whole function call rolls back:
--     no billing_events row, no audit, no state change, advisory locks released.
--     Fail-safe: any caller that ignores the signal already treats an RPC error as 503.
--   * Transient = CHECKOUT_NOT_FOUND where the event has NO sessionId, has a checkoutId
--     and a linkable checkout exists or may still be linked (an unlinked CREATING
--     session younger than 60 minutes). A sessionId is our own server-generated
--     externalReference, so an unknown sessionId stays terminal REJECTED. With no
--     pending checkout at all the unknown checkoutId stays terminal, which bounds
--     redelivery pressure (Asaas pauses a webhook queue after repeated failures).
--   * LINK_CONFLICT of an unlinked CREATING session cannot occur: that exact case is
--     already allowed when the event carries the session id. Extended the same
--     allowance to EXPIRED unlinked sessions so a payment arriving after the orphan
--     expiry below is applied, not lost. Other LINK_CONFLICTs remain terminal.
--   * DUPLICATE/STALE and already stored events are untouched; stored rows stay immutable.
--     Historic REJECTED CHECKOUT_NOT_FOUND rows are NOT replayed (needs human decision).
--   * AMOUNT_MISMATCH comparison is intentionally unchanged (needs Asaas sandbox evidence).
--
-- Decision (orphan CREATING): reserve_billing_checkout expires CREATING sessions with no
-- provider_checkout_id after 60 minutes from created_at (same window as READY), never
-- one already linked to a subscription. complete_billing_checkout becomes idempotent
-- when a webhook already moved the session to PAID with the same checkout id.

create or replace function public.reconcile_billing_event(p_event jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  event_key text; effect text; event_at timestamptz; provider_sub text;
  session_id uuid; checkout_id uuid; cycle_date date; priority integer;
  intent public.billing_checkout_sessions; sub public.subscriptions;
  prior_id uuid; event_sub uuid; placement_id uuid; result text := 'APPLIED';
  problem text; previous public.billing_events; retry boolean := false;
begin
  -- Public execution is service_role only; billing audit must be system actor.
  if auth.uid() is not null then raise exception 'system caller required' using errcode='42501'; end if;
  if jsonb_typeof(p_event) is distinct from 'object'
    or (p_event - array['provider','eventId','sourceType','occurredAt','action','sessionId','checkoutId','subscriptionId','paymentId','amountCents','currency','cycleDate']) <> '{}'::jsonb
    or not (p_event ?& array['provider','eventId','sourceType','occurredAt','action','sessionId','checkoutId','subscriptionId','paymentId','amountCents','currency','cycleDate'])
    or exists(select 1 from jsonb_each(p_event) field where field.key<>'amountCents'
      and jsonb_typeof(field.value) not in ('string','null'))
    or jsonb_typeof(p_event->'amountCents') not in ('number','null')
    or p_event->>'provider' is distinct from 'ASAAS'
    or coalesce(length(p_event->>'eventId'),0) not between 1 and 200
    or coalesce(length(p_event->>'sourceType'),0) not between 1 and 200
    or coalesce(p_event->>'action','') not in ('CONFIRMED','PAYMENT_FAILED','DISPUTED','REFUNDED','CANCELLED','EXPIRED','IGNORED')
    or coalesce(p_event->>'occurredAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'
    or coalesce(length(p_event->>'subscriptionId'),1) not between 1 and 200
    or coalesce(length(p_event->>'paymentId'),1) not between 1 and 200 then
    raise exception 'invalid normalized billing event' using errcode='22023';
  end if;
  event_key := p_event->>'eventId'; effect := p_event->>'action';
  event_at := (p_event->>'occurredAt')::timestamptz;
  provider_sub := p_event->>'subscriptionId';
  session_id := (p_event->>'sessionId')::uuid; checkout_id := (p_event->>'checkoutId')::uuid;
  cycle_date := (p_event->>'cycleDate')::date;
  priority := case effect when 'CONFIRMED' then 1 when 'PAYMENT_FAILED' then 2
    when 'DISPUTED' then 3 when 'REFUNDED' then 4 when 'EXPIRED' then 5 when 'CANCELLED' then 6 else 0 end;
  perform pg_advisory_xact_lock(hashtextextended('ASAAS:event:'||event_key,3104));
  select * into previous from public.billing_events where provider='ASAAS' and billing_events.event_id=event_key;
  if previous.id is not null then
    if previous.payload is distinct from p_event then return 'REJECTED'; end if;
    return 'DUPLICATE';
  end if;
  if effect='IGNORED' then
    insert into public.billing_events(provider,event_id,event_type,payload,occurred_at,processed_at)
      values('ASAAS',event_key,effect,p_event,event_at,clock_timestamp());
    return 'IGNORED';
  end if;
  if provider_sub is not null then
    perform pg_advisory_xact_lock(hashtextextended('ASAAS:subscription:'||provider_sub,3104));
    select * into sub from public.subscriptions where provider='ASAAS' and provider_subscription_id=provider_sub;
  end if;
  prior_id := sub.id;
  event_sub := sub.id;
  -- Derive identity from durable local linkage, never customer/email/browser data.
  if session_id is not null then
    select * into intent from public.billing_checkout_sessions where id=session_id;
  elsif checkout_id is not null then
    select * into intent from public.billing_checkout_sessions where provider_checkout_id=checkout_id;
  elsif sub.billing_checkout_session_id is not null then
    select * into intent from public.billing_checkout_sessions where id=sub.billing_checkout_session_id;
  end if;
  if intent.id is not null then
    -- Same lock as checkout reservation; serializes conflicting activations per user.
    perform pg_advisory_xact_lock(hashtextextended(intent.user_id::text,3103));
    select * into intent from public.billing_checkout_sessions where id=intent.id for update;
  elsif sub.id is not null then
    perform pg_advisory_xact_lock(hashtextextended(sub.user_id::text,3103));
  end if;
  if sub.id is not null then select * into sub from public.subscriptions where id=sub.id for update; end if;

  -- A subtransaction rolls back ALL commercial/Placement effects on a domain
  -- conflict, then the immutable event records the rejection in the outer tx.
  begin
    if provider_sub is null then raise exception 'SUBSCRIPTION_LINK_MISSING'; end if;
    if (session_id is not null or checkout_id is not null) and intent.id is null then raise exception 'CHECKOUT_NOT_FOUND'; end if;
    if intent.id is not null and (intent.provider<>'ASAAS'
      or (checkout_id is not null and intent.provider_checkout_id is distinct from checkout_id
        and not (intent.status in ('CREATING','EXPIRED') and intent.provider_checkout_id is null and session_id=intent.id))
      or (sub.id is not null and (sub.user_id<>intent.user_id or sub.billing_checkout_session_id is distinct from intent.id))) then
      raise exception 'LINK_CONFLICT';
    end if;
    if sub.id is not null and sub.billing_last_event_at is not null
      and (event_at<sub.billing_last_event_at
        or (event_at=sub.billing_last_event_at and priority<=sub.billing_last_event_priority)
        or (cycle_date is not null and sub.billing_last_cycle_date is not null and cycle_date<sub.billing_last_cycle_date)) then
      result := 'STALE';
    elsif sub.id is not null and sub.status='CANCELLED' and effect<>'CANCELLED' then
      raise exception 'SUBSCRIPTION_CANCELLED';
    elsif sub.id is not null and sub.status='EXPIRED' and effect in ('CONFIRMED','PAYMENT_FAILED','DISPUTED','REFUNDED')
      and sub.billing_last_cycle_date is not null and cycle_date<=sub.billing_last_cycle_date then
      raise exception 'EXPIRED_CYCLE';
    elsif effect in ('CANCELLED','EXPIRED') then
      if sub.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
      update public.subscriptions set status=case effect when 'CANCELLED' then 'CANCELLED' else 'EXPIRED' end,
        ended_at=greatest(started_at,clock_timestamp()),cancel_at_period_end=false,
        billing_last_event_at=event_at,billing_last_event_priority=priority where id=sub.id;
    else
      if intent.id is null then raise exception 'CHECKOUT_NOT_FOUND'; end if;
      if p_event->>'currency' is distinct from intent.currency then raise exception 'CURRENCY_MISMATCH'; end if;
      if jsonb_typeof(p_event->'amountCents') is distinct from 'number'
        or (p_event->>'amountCents')::numeric is distinct from intent.amount_cents::numeric then
        raise exception 'AMOUNT_MISMATCH';
      end if;
      if nullif(p_event->>'paymentId','') is null or cycle_date is null then raise exception 'PAYMENT_DATA_MISSING'; end if;
      if sub.id is null and effect<>'CONFIRMED' then raise exception 'INITIAL_PAYMENT_NOT_CONFIRMED'; end if;
      if effect='CONFIRMED' then
        if sub.id is null then
          if exists(select 1 from public.subscriptions where user_id=intent.user_id and status in ('TRIALING','ACTIVE','PAST_DUE')) then
            raise exception 'CURRENT_SUBSCRIPTION_CONFLICT';
          end if;
          insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status,billing_checkout_session_id)
            values(intent.user_id,intent.plan_id,'ASAAS',provider_sub,'ACTIVE',intent.id) returning * into sub;
          event_sub := sub.id;
        else
          update public.subscriptions set status='ACTIVE',ended_at=null where id=sub.id;
        end if;
        update public.billing_checkout_sessions set status='PAID',
          provider_checkout_id=coalesce(provider_checkout_id,checkout_id),updated_at=clock_timestamp() where id=intent.id;
        placement_id := private.ensure_initial_placement(intent.user_id,sub.id);
      else
        update public.subscriptions set status=case effect when 'REFUNDED' then 'EXPIRED' else 'PAST_DUE' end,
          ended_at=case effect when 'REFUNDED' then greatest(started_at,clock_timestamp()) else null end where id=sub.id;
      end if;
      update public.subscriptions set billing_last_event_at=event_at,billing_last_event_priority=priority,
        billing_last_cycle_date=cycle_date where id=sub.id;
    end if;
    if result='APPLIED' then
      insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
        values(null,'billing_reconciled','subscription',sub.id,
          jsonb_build_object('provider','ASAAS','event_id',event_key,'effect',effect,'placement_case_id',placement_id));
    end if;
  exception when raise_exception or integrity_constraint_violation or insufficient_privilege then
    result := 'REJECTED'; event_sub := prior_id;
    problem := case when sqlerrm in ('SUBSCRIPTION_LINK_MISSING','LINK_CONFLICT','SUBSCRIPTION_NOT_FOUND',
      'CHECKOUT_NOT_FOUND','CURRENCY_MISMATCH','AMOUNT_MISMATCH','PAYMENT_DATA_MISSING',
      'INITIAL_PAYMENT_NOT_CONFIRMED','SUBSCRIPTION_CANCELLED','EXPIRED_CYCLE','CURRENT_SUBSCRIPTION_CONFLICT')
      then sqlerrm else 'STATE_CONFLICT' end;
    -- Transient: a checkout-only event whose checkout is not linked yet while
    -- complete_billing_checkout may still run. One statement, so a link committed
    -- between the lookup above and this check is still seen as linked (retry).
    retry := problem='CHECKOUT_NOT_FOUND' and session_id is null and checkout_id is not null
      and exists(select 1 from public.billing_checkout_sessions c where c.provider='ASAAS'
        and (c.provider_checkout_id=checkout_id
          or (c.status='CREATING' and c.provider_checkout_id is null
            and c.created_at>clock_timestamp()-interval '60 minutes')));
  end;
  -- Outside the subtransaction: nothing was written and no event row exists, so
  -- the provider redelivery is evaluated from scratch (never an immutable REJECTED).
  if retry then
    raise exception 'BILLING_EVENT_RETRY' using errcode='PT503', detail='CHECKOUT_NOT_LINKED',
      hint='Transient: provider checkout not linked yet; redeliver the same event.';
  end if;
  insert into public.billing_events(provider,event_id,event_type,subscription_id,payload,occurred_at,processed_at,processing_error)
    values('ASAAS',event_key,effect,event_sub,p_event,event_at,clock_timestamp(),problem);
  return result;
end $$;

create or replace function public.reserve_billing_checkout(p_user_id uuid, p_plan_code text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_session public.billing_checkout_sessions;
  v_plan public.plans;
  v_claimed boolean := false;
begin
  -- Serializes different plan selections for the same authenticated identity.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 3103));
  if not exists (select 1 from public.user_roles where user_id = p_user_id and role = 'STUDENT') then
    raise exception 'Student required';
  end if;
  select * into v_plan from public.plans where code = p_plan_code and active and currency = 'BRL' and billing_interval = 'MONTH' and amount_cents > 0;
  if not found then raise exception 'Plan unavailable'; end if;
  -- Expired READY links and orphan CREATING intents (below) can be replaced.
  update public.billing_checkout_sessions set status = 'EXPIRED', updated_at = now()
    where user_id = p_user_id and status = 'READY' and expires_at <= now();
  -- Orphan CREATING (provider id never persisted) frees the user after the same 60
  -- minute window as READY. Never a session that already produced a subscription.
  update public.billing_checkout_sessions c set status = 'EXPIRED', updated_at = now()
    where c.user_id = p_user_id and c.status = 'CREATING' and c.provider_checkout_id is null
      and c.created_at <= now() - interval '60 minutes'
      and not exists (select 1 from public.subscriptions s where s.billing_checkout_session_id = c.id);
  select * into v_session from public.billing_checkout_sessions
    where user_id = p_user_id and status in ('CREATING', 'READY');
  if found then
    if v_session.plan_id <> v_plan.id then raise exception 'Checkout already pending for another plan'; end if;
  else
    insert into public.billing_checkout_sessions(user_id, plan_id, amount_cents, currency, plan_name, next_due_date)
      values (p_user_id, v_plan.id, v_plan.amount_cents, v_plan.currency, v_plan.name, (now() at time zone 'America/Sao_Paulo')::date)
      returning * into v_session;
    v_claimed := true;
  end if;
  return jsonb_build_object('sessionId', v_session.id, 'name', v_session.plan_name,
    'amountCents', v_session.amount_cents, 'currency', v_session.currency,
    'nextDueDate', v_session.next_due_date, 'claimed', v_claimed, 'checkoutId', v_session.provider_checkout_id);
end;
$$;

create or replace function public.complete_billing_checkout(p_session_id uuid, p_checkout_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.billing_checkout_sessions set provider_checkout_id = p_checkout_id, status = 'READY',
    -- Provider expiry starts at request creation, not when persistence finishes.
    expires_at = created_at + interval '60 minutes', updated_at = now()
    where id = p_session_id and status = 'CREATING';
  if not found and not exists (select 1 from public.billing_checkout_sessions
      where id = p_session_id and status in ('READY', 'PAID') and provider_checkout_id = p_checkout_id) then
    raise exception 'Checkout completion conflict';
  end if;
end;
$$;

-- reserve_billing_checkout is security invoker: make the orphan guard's read explicit (column-scoped).
grant select (billing_checkout_session_id) on public.subscriptions to service_role;

revoke all on function public.reconcile_billing_event(jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_billing_event(jsonb) to service_role;
comment on function public.reconcile_billing_event(jsonb) is
  'Service-only atomic normalized billing event, immutable history, snapshot reconciliation and initial Placement. Transient unlinked-checkout events raise PT503 BILLING_EVENT_RETRY without storing an event. No Auth impersonation.';

revoke all on function public.reserve_billing_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_billing_checkout(uuid, text) to service_role;
revoke all on function public.complete_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_billing_checkout(uuid, uuid) to service_role;
