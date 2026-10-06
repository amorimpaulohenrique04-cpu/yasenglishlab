-- Only provider-confirmed state grants access. Due dates are ordering markers,
-- not invented subscription period boundaries. Existing null-period contract
-- remains in force until authoritative period data is available.
alter table public.subscriptions
  add column billing_checkout_session_id uuid references public.billing_checkout_sessions(id) on delete restrict,
  add column billing_last_event_at timestamptz,
  add column billing_last_event_priority integer,
  add column billing_last_cycle_date date;
create unique index subscriptions_billing_checkout_unique
  on public.subscriptions(billing_checkout_session_id) where billing_checkout_session_id is not null;

create function private.ensure_initial_placement(p_user_id uuid, p_subscription_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not exists (select 1 from public.subscriptions where id=p_subscription_id and user_id=p_user_id
    and status='ACTIVE' and started_at<=now() and (ended_at is null or ended_at>now())
    and (current_period_start is null or current_period_start<=now())
    and (current_period_end is null or current_period_end>now()))
    or not exists (select 1 from public.user_roles where user_id=p_user_id and role='STUDENT') then
    raise exception 'confirmed commercial state required' using errcode='42501';
  end if;
  insert into public.placement_cases(user_id,subscription_id) values(p_user_id,p_subscription_id)
    on conflict(user_id) do nothing returning id into target;
  if target is null then select id into target from public.placement_cases where user_id=p_user_id; end if;
  return target;
end $$;
revoke all on function private.ensure_initial_placement(uuid,uuid) from public,anon,authenticated,service_role;

-- Preserve Student authorization and the existing retry/state-machine behavior.
create or replace function public.begin_placement()
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid; sub uuid;
begin
  if auth.uid() is null or not private.has_role('STUDENT',false) then
    raise exception 'Student required' using errcode='42501';
  end if;
  select id into target from public.placement_cases where user_id=auth.uid();
  if target is not null then return target; end if;
  select id into sub from public.subscriptions where user_id=auth.uid() and status='ACTIVE'
    and started_at<=now() and (ended_at is null or ended_at>now())
    and (current_period_start is null or current_period_start<=now())
    and (current_period_end is null or current_period_end>now()) order by created_at desc limit 1;
  return private.ensure_initial_placement(auth.uid(),sub);
end $$;

create function public.reconcile_billing_event(p_event jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  event_key text; effect text; event_at timestamptz; provider_sub text;
  session_id uuid; checkout_id uuid; cycle_date date; priority integer;
  intent public.billing_checkout_sessions; sub public.subscriptions;
  prior_id uuid; event_sub uuid; placement_id uuid; result text := 'APPLIED';
  problem text; previous public.billing_events;
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
        and not (intent.status='CREATING' and intent.provider_checkout_id is null and session_id=intent.id))
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
  end;
  insert into public.billing_events(provider,event_id,event_type,subscription_id,payload,occurred_at,processed_at,processing_error)
    values('ASAAS',event_key,effect,event_sub,p_event,event_at,clock_timestamp(),problem);
  return result;
end $$;
revoke all on function public.reconcile_billing_event(jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_billing_event(jsonb) to service_role;
comment on function public.reconcile_billing_event(jsonb) is
  'Service-only atomic normalized billing event, immutable history, snapshot reconciliation and initial Placement. No Auth impersonation.';
