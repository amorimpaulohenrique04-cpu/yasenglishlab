-- PR2 / Block 2B: a Student may ask to change plan at the NEXT RENEWAL. This records the request only.
-- It never changes subscriptions.plan_id, entitlements or quotas, never charges a difference and never
-- calls the provider: the commercial policy for upgrades, downgrades and pro-rata is still undecided
-- (docs/OPEN_QUESTIONS.md). Applying a request is a separate, later, Admin-approved step.
create table public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  from_plan_id uuid not null references public.plans(id),
  to_plan_id uuid not null references public.plans(id),
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (from_plan_id <> to_plan_id),
  check ((status = 'CANCELLED') = (cancelled_at is not null))
);
create unique index plan_change_one_open_per_user on public.plan_change_requests(user_id) where status = 'REQUESTED';
alter table public.plan_change_requests enable row level security;
create policy plan_change_own_select on public.plan_change_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('ADMIN', true));
revoke all on public.plan_change_requests from anon, authenticated;
grant select on public.plan_change_requests to authenticated;

create function public.request_plan_change(p_plan_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_sub public.subscriptions;
  v_to public.plans;
  v_open public.plan_change_requests;
  v_id uuid;
begin
  if v_user is null or not private.has_role('STUDENT', false) then
    raise exception 'STUDENT required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('plan-change:' || v_user::text, 0));
  select * into v_sub from public.subscriptions
    where user_id = v_user and status = 'ACTIVE' and not cancel_at_period_end
    order by started_at desc limit 1;
  if not found then raise exception 'active subscription required' using errcode = '23514'; end if;
  select * into v_to from public.plans where code = p_plan_code and active and currency = 'BRL' and billing_interval = 'MONTH';
  if not found or v_to.id = v_sub.plan_id then raise exception 'different active plan required' using errcode = '23514'; end if;
  select * into v_open from public.plan_change_requests where user_id = v_user and status = 'REQUESTED';
  if found then
    if v_open.to_plan_id = v_to.id and v_open.subscription_id = v_sub.id then return v_open.id; end if;
    update public.plan_change_requests set status = 'CANCELLED', cancelled_at = now() where id = v_open.id;
  end if;
  insert into public.plan_change_requests(user_id, subscription_id, from_plan_id, to_plan_id)
  values (v_user, v_sub.id, v_sub.plan_id, v_to.id) returning id into v_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (v_user, 'PLAN_CHANGE_REQUESTED', 'plan_change_requests', v_id,
    jsonb_build_object('from_plan_id', v_sub.plan_id, 'to_plan_id', v_to.id, 'policy', 'NEXT_RENEWAL'));
  return v_id;
end $$;

create function public.cancel_plan_change() returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.has_role('STUDENT', false) then
    raise exception 'STUDENT required' using errcode = '42501';
  end if;
  update public.plan_change_requests set status = 'CANCELLED', cancelled_at = now()
    where user_id = auth.uid() and status = 'REQUESTED' returning id into v_id;
  if v_id is not null then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'PLAN_CHANGE_CANCELLED', 'plan_change_requests', v_id, '{}');
  end if;
end $$;
revoke all on function public.request_plan_change(text), public.cancel_plan_change() from public, anon;
grant execute on function public.request_plan_change(text), public.cancel_plan_change() to authenticated;
