-- Additive: one payment notification per provider payment+cycle (Asaas emits
-- PAYMENT_CONFIRMED and PAYMENT_RECEIVED for the same payment, both normalized
-- to CONFIRMED), and distinct renewal copy. Does not touch reconcile_billing_event.
-- The trigger from 03e keeps pointing at this function name; CREATE OR REPLACE swaps the body.
create or replace function private.billing_notification_outbox() returns trigger
language plpgsql security definer set search_path='' as $$
declare mirror public.subscriptions; priority integer; target_type text; heading text; copy text; notification uuid;
  payment text; cycle text; key text; renewal boolean;
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
  payment := nullif(new.payload->>'paymentId','');
  cycle := nullif(new.payload->>'cycleDate','');
  if new.event_type='CONFIRMED' and mirror.status='ACTIVE' then
    target_type := 'PAYMENT_CONFIRMED'; heading := 'Pagamento confirmado'; copy := 'Seu pagamento foi confirmado e sua assinatura Yas está ativa.';
    -- Renewal = an earlier, different payment of this subscription already produced a
    -- confirmation notification. Copy only; the dedupe key below never depends on it.
    if payment is not null and cycle is not null then
      select exists(
        select 1 from public.billing_events b
        join public.notifications n on n.dedupe_key in (
          'billing:asaas:payment:'||(b.payload->>'paymentId')||':'||(b.payload->>'cycleDate')||':payment_confirmed',
          'billing:'||b.id::text||':payment_confirmed') -- second form: pre-dedupe 03e keys
        where b.provider='ASAAS' and b.subscription_id=new.subscription_id and b.event_type='CONFIRMED'
          and b.processing_error is null and b.id<>new.id
          and n.user_id=mirror.user_id and n.notification_type in ('PAYMENT_CONFIRMED','PAYMENT_RENEWED')
          and (b.payload->>'paymentId' is distinct from payment or b.payload->>'cycleDate' is distinct from cycle)
      ) into renewal;
      if renewal then
        target_type := 'PAYMENT_RENEWED'; heading := 'Pagamento da renovação confirmado';
        copy := 'Recebemos o pagamento da renovação e sua assinatura Yas segue ativa.';
      end if;
    end if;
  elsif new.event_type in ('PAYMENT_FAILED','DISPUTED') and mirror.status='PAST_DUE' then
    target_type := 'PAYMENT_ISSUE'; heading := 'Há uma pendência no seu pagamento'; copy := 'Identificamos uma pendência na sua assinatura Yas.';
  elsif new.event_type in ('REFUNDED','EXPIRED','CANCELLED') and mirror.status in ('EXPIRED','CANCELLED') then
    target_type := 'SUBSCRIPTION_ENDED'; heading := 'Sua assinatura foi encerrada'; copy := 'Sua assinatura Yas foi encerrada.';
  else return new;
  end if;
  -- Payment-scoped dedupe for confirmation/issue; the key uses the base class so a
  -- renewal-vs-first copy variant can never produce a second email for one payment.
  -- Missing payment data or subscription-level events keep the per-event key.
  if target_type in ('PAYMENT_CONFIRMED','PAYMENT_RENEWED','PAYMENT_ISSUE') and payment is not null and cycle is not null then
    key := 'billing:asaas:payment:'||payment||':'||cycle||':'||case when target_type='PAYMENT_ISSUE' then 'payment_issue' else 'payment_confirmed' end;
  else
    key := 'billing:'||new.id::text||':'||lower(target_type);
  end if;
  insert into public.notifications(user_id,notification_type,title,body,dedupe_key)
    values(mirror.user_id,target_type,heading,copy,key)
    on conflict(dedupe_key) where dedupe_key is not null do nothing returning id into notification;
  if notification is not null then
    insert into public.notification_deliveries(notification_id) values(notification) on conflict(notification_id,channel) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.billing_notification_outbox() from public,anon,authenticated,service_role;
