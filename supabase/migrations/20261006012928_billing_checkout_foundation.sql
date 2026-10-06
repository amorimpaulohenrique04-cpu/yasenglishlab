-- Server-only intent. No payment authority or card/customer payload here.
create table public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan_id uuid not null references public.plans(id),
  provider text not null default 'ASAAS' check (provider = 'ASAAS'),
  provider_checkout_id uuid unique,
  status text not null default 'CREATING' check (status in ('CREATING', 'READY', 'EXPIRED', 'CANCELLED', 'PAID')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'BRL'),
  plan_name text not null,
  next_due_date date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'READY' or (provider_checkout_id is not null and expires_at is not null))
);
create unique index billing_checkout_one_open_per_user on public.billing_checkout_sessions(user_id)
  where status in ('CREATING', 'READY');
alter table public.billing_checkout_sessions enable row level security;
revoke all on public.billing_checkout_sessions from public, anon, authenticated;
grant select, insert, update on public.billing_checkout_sessions to service_role;
-- Invoker RPC needs explicit reads; BYPASSRLS does not imply table privileges.
grant select (user_id, role) on public.user_roles to service_role;
grant select on public.plans to service_role;

create function public.reserve_billing_checkout(p_user_id uuid, p_plan_code text)
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
  -- Expired READY links can be replaced; ambiguous CREATING intents cannot.
  update public.billing_checkout_sessions set status = 'EXPIRED', updated_at = now()
    where user_id = p_user_id and status = 'READY' and expires_at <= now();
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
revoke all on function public.reserve_billing_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_billing_checkout(uuid, text) to service_role;

create function public.complete_billing_checkout(p_session_id uuid, p_checkout_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.billing_checkout_sessions set provider_checkout_id = p_checkout_id, status = 'READY',
    -- Provider expiry starts at request creation, not when persistence finishes.
    expires_at = created_at + interval '60 minutes', updated_at = now()
    where id = p_session_id and status = 'CREATING';
  if not found and not exists (select 1 from public.billing_checkout_sessions
      where id = p_session_id and status = 'READY' and provider_checkout_id = p_checkout_id) then
    raise exception 'Checkout completion conflict';
  end if;
end;
$$;
revoke all on function public.complete_billing_checkout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_billing_checkout(uuid, uuid) to service_role;
