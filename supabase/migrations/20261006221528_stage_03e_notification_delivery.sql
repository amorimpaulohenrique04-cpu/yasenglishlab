-- Transactional notification state and operational email outbox; no provider I/O.
alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe_key_unique on public.notifications(dedupe_key) where dedupe_key is not null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null default 'EMAIL' check (channel='EMAIL'),
  provider text not null default 'RESEND' check (provider='RESEND'),
  status text not null default 'PENDING' check (status in ('PENDING','SENDING','SENT','FAILED')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  idempotency_key text generated always as ('notification-email:' || id::text) stored unique,
  provider_message_id text check (provider_message_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  template_version integer not null default 1 check (template_version=1),
  next_attempt_at timestamptz default now(),
  first_attempt_at timestamptz,
  claim_token uuid,
  lease_until timestamptz,
  last_error_code text check (last_error_code in ('PROVIDER_RATE_LIMIT','PROVIDER_UNAVAILABLE','NETWORK_ERROR','PROVIDER_BUSY','PROVIDER_REJECTED','PROVIDER_RESPONSE_INVALID','INVALID_CONFIG','INVALID_REQUEST','RECIPIENT_MISSING','RECIPIENT_UNVERIFIED','RECIPIENT_LOOKUP_UNAVAILABLE','UNSUPPORTED_TEMPLATE','PROCESSOR_ERROR','MAX_ATTEMPTS','IDEMPOTENCY_WINDOW_EXPIRED','DELIVERY_LEASE_EXPIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(notification_id,channel),
  check ((status='SENDING') = (claim_token is not null and lease_until is not null)),
  check (status='SENDING' or (claim_token is null and lease_until is null)),
  check (status<>'PENDING' or next_attempt_at is not null),
  check ((status='SENT') = (sent_at is not null and provider_message_id is not null)),
  check ((attempt_count=0) = (first_attempt_at is null))
);
create index notification_deliveries_pending on public.notification_deliveries(next_attempt_at,created_at,id) where status='PENDING';
create index notification_deliveries_abandoned on public.notification_deliveries(lease_until,created_at,id) where status='SENDING';
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public,anon,authenticated,service_role;
grant select on public.notification_deliveries to service_role;
grant update(status,attempt_count,provider_message_id,next_attempt_at,first_attempt_at,claim_token,lease_until,last_error_code,updated_at,sent_at) on public.notification_deliveries to service_role;
grant select(id,user_id,notification_type) on public.notifications to service_role;

create function private.protect_notification_delivery() returns trigger
language plpgsql set search_path='' as $$
begin
  if (old.id,old.notification_id,old.channel,old.provider,old.template_version)
    is distinct from (new.id,new.notification_id,new.channel,new.provider,new.template_version)
    or (old.status in ('SENT','FAILED') and new is distinct from old) then
    raise exception 'delivery identity and terminal state are immutable' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.protect_notification_delivery() from public,anon,authenticated,service_role;
create trigger notification_deliveries_protect before update on public.notification_deliveries
for each row execute function private.protect_notification_delivery();

create function private.billing_notification_outbox() returns trigger
language plpgsql security definer set search_path='' as $$
declare mirror public.subscriptions; priority integer; target_type text; heading text; copy text; notification uuid;
begin
  if new.provider<>'ASAAS' or new.processing_error is not null or new.processed_at is null or new.subscription_id is null then return new; end if;
  priority := case new.event_type when 'CONFIRMED' then 1 when 'PAYMENT_FAILED' then 2 when 'DISPUTED' then 3 when 'REFUNDED' then 4 when 'EXPIRED' then 5 when 'CANCELLED' then 6 else 0 end;
  if priority=0 then return new; end if;
  select * into mirror from public.subscriptions where id=new.subscription_id;
  if mirror.billing_last_event_at is distinct from new.occurred_at or mirror.billing_last_event_priority is distinct from priority then return new; end if;
  -- Equal timestamp/priority can also be STALE. Only APPLIED writes this audit.
  if not exists(select 1 from public.audit_logs a where a.action='billing_reconciled'
    and a.entity_type='subscription' and a.entity_id=new.subscription_id and a.actor_user_id is null
    and a.data->>'provider'=new.provider and a.data->>'event_id'=new.event_id and a.data->>'effect'=new.event_type) then return new; end if;
  if new.event_type='CONFIRMED' and mirror.status='ACTIVE' then
    target_type := 'PAYMENT_CONFIRMED'; heading := 'Pagamento confirmado'; copy := 'Seu pagamento foi confirmado e sua assinatura Yas está ativa.';
  elsif new.event_type in ('PAYMENT_FAILED','DISPUTED') and mirror.status='PAST_DUE' then
    target_type := 'PAYMENT_ISSUE'; heading := 'Há uma pendência no seu pagamento'; copy := 'Identificamos uma pendência na sua assinatura Yas.';
  elsif new.event_type in ('REFUNDED','EXPIRED','CANCELLED') and mirror.status in ('EXPIRED','CANCELLED') then
    target_type := 'SUBSCRIPTION_ENDED'; heading := 'Sua assinatura foi encerrada'; copy := 'Sua assinatura Yas foi encerrada.';
  else return new;
  end if;
  insert into public.notifications(user_id,notification_type,title,body,dedupe_key)
    values(mirror.user_id,target_type,heading,copy,'billing:'||new.id::text||':'||lower(target_type))
    on conflict(dedupe_key) where dedupe_key is not null do nothing returning id into notification;
  if notification is not null then
    insert into public.notification_deliveries(notification_id) values(notification) on conflict(notification_id,channel) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.billing_notification_outbox() from public,anon,authenticated,service_role;
create trigger billing_events_notification_outbox after insert on public.billing_events
for each row execute function private.billing_notification_outbox();

-- Service-only invoker commands retain table least privilege and use claim fencing.
create function public.claim_notification_deliveries(p_limit integer default 10)
returns table(delivery_id uuid,user_id uuid,notification_type text,template_version integer,attempt_count integer,idempotency_key text,claim_token uuid)
language plpgsql set search_path='' as $$
begin
  if auth.uid() is not null then raise exception 'system caller required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 25 then raise exception 'batch limit must be 1..25' using errcode='22023'; end if;
  return query with eligible as (
    select d.id from public.notification_deliveries d where
      (d.status='PENDING' and d.next_attempt_at<=clock_timestamp()) or
      (d.status='SENDING' and d.lease_until<=clock_timestamp())
    order by d.created_at,d.id for update skip locked limit p_limit
  ), claimed as (
    update public.notification_deliveries d set
      status=case when d.attempt_count>=5 or d.first_attempt_at<=clock_timestamp()-interval '23 hours' then 'FAILED' else 'SENDING' end,
      attempt_count=d.attempt_count+case when d.attempt_count>=5 or d.first_attempt_at<=clock_timestamp()-interval '23 hours' then 0 else 1 end,
      first_attempt_at=coalesce(d.first_attempt_at,clock_timestamp()),next_attempt_at=null,
      claim_token=case when d.attempt_count>=5 or d.first_attempt_at<=clock_timestamp()-interval '23 hours' then null else gen_random_uuid() end,
      lease_until=case when d.attempt_count>=5 or d.first_attempt_at<=clock_timestamp()-interval '23 hours' then null else clock_timestamp()+interval '2 minutes' end,
      last_error_code=case when d.first_attempt_at<=clock_timestamp()-interval '23 hours' then 'IDEMPOTENCY_WINDOW_EXPIRED' when d.attempt_count>=5 then 'MAX_ATTEMPTS' when d.status='SENDING' then 'DELIVERY_LEASE_EXPIRED' else d.last_error_code end,
      updated_at=clock_timestamp()
    from eligible e where d.id=e.id returning d.*
  ) select d.id,n.user_id,n.notification_type,d.template_version,d.attempt_count,d.idempotency_key,d.claim_token
    from claimed d join public.notifications n on n.id=d.notification_id where d.status='SENDING';
end $$;

create function public.complete_notification_delivery(p_delivery_id uuid,p_claim_token uuid,p_message_id text)
returns boolean language plpgsql set search_path='' as $$
declare changed integer;
begin
  if auth.uid() is not null then raise exception 'system caller required' using errcode='42501'; end if;
  if p_message_id is null or p_message_id !~ '^[A-Za-z0-9_-]{1,200}$' then raise exception 'invalid message id' using errcode='22023'; end if;
  update public.notification_deliveries set status='SENT',provider_message_id=p_message_id,sent_at=clock_timestamp(),updated_at=clock_timestamp(),claim_token=null,lease_until=null,last_error_code=null
    where id=p_delivery_id and status='SENDING' and claim_token=p_claim_token and lease_until>clock_timestamp();
  get diagnostics changed=row_count;
  return changed=1;
end $$;

create function public.fail_notification_delivery(p_delivery_id uuid,p_claim_token uuid,p_error_code text,p_retryable boolean)
returns text language plpgsql set search_path='' as $$
declare outcome text;
begin
  if auth.uid() is not null then raise exception 'system caller required' using errcode='42501'; end if;
  if p_error_code is null or p_error_code not in ('PROVIDER_RATE_LIMIT','PROVIDER_UNAVAILABLE','NETWORK_ERROR','PROVIDER_BUSY','PROVIDER_REJECTED','PROVIDER_RESPONSE_INVALID','INVALID_CONFIG','INVALID_REQUEST','RECIPIENT_MISSING','RECIPIENT_UNVERIFIED','RECIPIENT_LOOKUP_UNAVAILABLE','UNSUPPORTED_TEMPLATE','PROCESSOR_ERROR','MAX_ATTEMPTS','IDEMPOTENCY_WINDOW_EXPIRED') or p_retryable is null then raise exception 'invalid delivery error' using errcode='22023'; end if;
  update public.notification_deliveries d set
    status=case when p_retryable and d.attempt_count<5 and d.first_attempt_at>clock_timestamp()-interval '23 hours' then 'PENDING' else 'FAILED' end,
    next_attempt_at=case when p_retryable and d.attempt_count<5 and d.first_attempt_at>clock_timestamp()-interval '23 hours' then clock_timestamp()+make_interval(secs=>60*power(2,d.attempt_count-1)::integer) else null end,
    last_error_code=p_error_code,updated_at=clock_timestamp(),claim_token=null,lease_until=null
    where d.id=p_delivery_id and d.status='SENDING' and d.claim_token=p_claim_token and d.lease_until>clock_timestamp()
    returning d.status into outcome;
  return coalesce(outcome,'LOST');
end $$;
revoke all on function public.claim_notification_deliveries(integer),public.complete_notification_delivery(uuid,uuid,text),public.fail_notification_delivery(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(integer),public.complete_notification_delivery(uuid,uuid,text),public.fail_notification_delivery(uuid,uuid,text,boolean) to service_role;
