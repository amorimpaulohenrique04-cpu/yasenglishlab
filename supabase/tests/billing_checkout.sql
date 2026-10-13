begin;
insert into auth.users(id, email) values ('fa000000-0000-4000-8000-000000000001', 'billing-test@example.test');
insert into public.user_roles(user_id, role) values ('fa000000-0000-4000-8000-000000000001', 'STUDENT');

do $$
declare first jsonb; second jsonb; ready jsonb;
begin
  first := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if not (first->>'claimed')::boolean or (second->>'claimed')::boolean or first->>'sessionId' <> second->>'sessionId' then raise exception 'Duplicate reservation'; end if;
  if (first->>'amountCents')::int <> 9990 then raise exception 'Incorrect server price'; end if;
  update public.plans set amount_cents = 19990 where code = 'START';
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if (second->>'amountCents')::int <> 9990 then raise exception 'Historical snapshot overwritten'; end if;
  begin
    perform public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'TALK');
    raise exception 'Different plan accepted';
  exception when raise_exception then
    if sqlerrm <> 'Checkout already pending for another plan' then raise; end if;
  end;
  -- CREATING stays reserved inside the 60 minute window: ambiguous request must reconcile.
  update public.billing_checkout_sessions set created_at = now() - interval '59 minutes';
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if (second->>'claimed')::boolean or second->>'sessionId' <> first->>'sessionId' then raise exception 'Ambiguous request retried'; end if;
  perform public.complete_billing_checkout((first->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000001');
  perform public.complete_billing_checkout((first->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000001');
  -- Previous conservative expiry permits a fresh checkout only after READY.
  update public.billing_checkout_sessions set expires_at = now() - interval '1 minute' where id = (first->>'sessionId')::uuid;
  ready := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if not (ready->>'claimed')::boolean or ready->>'sessionId' = first->>'sessionId' then raise exception 'Expired link reused'; end if;
  perform public.complete_billing_checkout((ready->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000002');
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if (second->>'claimed')::boolean or second->>'checkoutId' <> 'fb000000-0000-4000-8000-000000000002' then raise exception 'Ready link not reused'; end if;
  if exists (select 1 from public.subscriptions where user_id = 'fa000000-0000-4000-8000-000000000001') then raise exception 'Checkout granted subscription'; end if;
end;
$$;

insert into auth.users(id, email) values
  ('fa000000-0000-4000-8000-000000000002', 'billing-orphan-a@example.test'),
  ('fa000000-0000-4000-8000-000000000003', 'billing-orphan-b@example.test'),
  ('fa000000-0000-4000-8000-000000000004', 'billing-orphan-c@example.test');
insert into public.user_roles(user_id, role) select id, 'STUDENT' from auth.users where id::text like 'fa000000-0000-4000-8000-00000000000%' and id <> 'fa000000-0000-4000-8000-000000000001';

-- Orphan CREATING (provider id never persisted) expires after the explicit 60 minute window.
do $$
declare u constant uuid := 'fa000000-0000-4000-8000-000000000002'; first jsonb; again jsonb; fresh jsonb;
begin
  first := public.reserve_billing_checkout(u, 'START');
  -- Boundary: exactly 60 minutes is expired (<=), 59 minutes is still reserved.
  update public.billing_checkout_sessions set created_at = now() - interval '59 minutes 59 seconds' where id = (first->>'sessionId')::uuid;
  again := public.reserve_billing_checkout(u, 'START');
  if (again->>'claimed')::boolean or again->>'sessionId' <> first->>'sessionId' then raise exception 'CREATING expired before the window'; end if;
  update public.billing_checkout_sessions set created_at = now() - interval '60 minutes' where id = (first->>'sessionId')::uuid;
  fresh := public.reserve_billing_checkout(u, 'START');
  if not (fresh->>'claimed')::boolean or fresh->>'sessionId' = first->>'sessionId' then raise exception 'Orphan CREATING still blocks the user'; end if;
  if (select status from public.billing_checkout_sessions where id = (first->>'sessionId')::uuid) <> 'EXPIRED' then raise exception 'Orphan not EXPIRED'; end if;
  if (select count(*) from public.billing_checkout_sessions where user_id = u and status in ('CREATING', 'READY')) <> 1 then raise exception 'Open session invariant broken'; end if;
  if exists (select 1 from public.subscriptions where user_id = u) then raise exception 'Expiry granted access'; end if;
end $$;

-- Negative: sessions that are linked, paid, or already carry a subscription are never expired by the orphan rule.
do $$
declare u constant uuid := 'fa000000-0000-4000-8000-000000000003'; v constant uuid := 'fa000000-0000-4000-8000-000000000004';
  s jsonb; again jsonb; sid uuid;
begin
  -- Old CREATING already tied to an applied subscription (webhook recovered it) stays untouched.
  s := public.reserve_billing_checkout(u, 'START'); sid := (s->>'sessionId')::uuid;
  update public.billing_checkout_sessions set created_at = now() - interval '3 hours' where id = sid;
  insert into public.subscriptions(user_id, plan_id, provider, provider_subscription_id, status, billing_checkout_session_id)
    values (u, (select plan_id from public.billing_checkout_sessions where id = sid), 'ASAAS', 'sub_orphan_guard', 'ACTIVE', sid);
  again := public.reserve_billing_checkout(u, 'START');
  if (again->>'claimed')::boolean or again->>'sessionId' <> sid::text then raise exception 'Session with applied payment was expired'; end if;
  if (select status from public.billing_checkout_sessions where id = sid) <> 'CREATING' then raise exception 'Session with applied payment changed'; end if;
  -- READY (provider id persisted) is governed only by expires_at, even when created long ago.
  s := public.reserve_billing_checkout(v, 'START'); sid := (s->>'sessionId')::uuid;
  perform public.complete_billing_checkout(sid, 'fb000000-0000-4000-8000-000000000009');
  update public.billing_checkout_sessions set created_at = now() - interval '3 hours', expires_at = now() + interval '10 minutes' where id = sid;
  again := public.reserve_billing_checkout(v, 'START');
  if (again->>'claimed')::boolean or again->>'checkoutId' <> 'fb000000-0000-4000-8000-000000000009' then raise exception 'Linked READY session was replaced'; end if;
  -- PAID is terminal and not an open session.
  update public.billing_checkout_sessions set status = 'PAID' where id = sid;
  update public.billing_checkout_sessions set created_at = now() - interval '4 hours' where id = sid;
  again := public.reserve_billing_checkout(v, 'START');
  if (select status from public.billing_checkout_sessions where id = sid) <> 'PAID' then raise exception 'PAID session modified'; end if;
  -- complete is idempotent for a PAID session of the same checkout, but not for another checkout.
  perform public.complete_billing_checkout(sid, 'fb000000-0000-4000-8000-000000000009');
  begin
    perform public.complete_billing_checkout(sid, 'fb000000-0000-4000-8000-00000000000a');
    raise exception 'Different checkout accepted';
  exception when raise_exception then
    if sqlerrm <> 'Checkout completion conflict' then raise; end if;
  end;
end $$;

do $$
declare r text; operation text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.billing_checkout_sessions'::regclass) then raise exception 'RLS missing'; end if;
  foreach r in array array['anon', 'authenticated'] loop
    foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege(r, 'public.billing_checkout_sessions', operation) then raise exception 'Client privilege % %', r, operation; end if;
    end loop;
    if has_function_privilege(r, 'public.reserve_billing_checkout(uuid,text)', 'EXECUTE') or has_function_privilege(r, 'public.complete_billing_checkout(uuid,uuid)', 'EXECUTE') then raise exception 'Public RPC'; end if;
  end loop;
end;
$$;

set local role authenticated;
do $$ begin
  begin perform * from public.billing_checkout_sessions; raise exception 'Client read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001','START'); raise exception 'Client write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001','START');
reset role;
rollback;
