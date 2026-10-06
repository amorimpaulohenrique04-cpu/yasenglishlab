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
  -- CREATING remains reserved even after an hour: ambiguous request must reconcile.
  update public.billing_checkout_sessions set created_at = now() - interval '2 hours';
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if (second->>'claimed')::boolean then raise exception 'Ambiguous request retried'; end if;
  perform public.complete_billing_checkout((first->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000001');
  perform public.complete_billing_checkout((first->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000001');
  -- Previous conservative expiry permits a fresh checkout only after READY.
  ready := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if not (ready->>'claimed')::boolean or ready->>'sessionId' = first->>'sessionId' then raise exception 'Expired link reused'; end if;
  perform public.complete_billing_checkout((ready->>'sessionId')::uuid, 'fb000000-0000-4000-8000-000000000002');
  second := public.reserve_billing_checkout('fa000000-0000-4000-8000-000000000001', 'START');
  if (second->>'claimed')::boolean or second->>'checkoutId' <> 'fb000000-0000-4000-8000-000000000002' then raise exception 'Ready link not reused'; end if;
  if exists (select 1 from public.subscriptions where user_id = 'fa000000-0000-4000-8000-000000000001') then raise exception 'Checkout granted subscription'; end if;
end;
$$;

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
