-- PR2 / Block 2A: operator-run reconciliation of the local subscription mirror against the provider.
-- It only RECORDS discrepancies. It never changes subscription status, access or entitlements and never
-- creates a charge: access still changes only through reconcile_billing_event (verified financial events).
create table public.billing_reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  kind text not null check (kind in (
    'PROVIDER_ENDED_LOCAL_ACTIVE',
    'LOCAL_ENDED_PROVIDER_ACTIVE',
    'PAST_DUE_WITHOUT_OVERDUE_CHARGE',
    'ACTIVE_WITH_OVERDUE_CHARGE'
  )),
  -- Sanitised facts only: provider status, counts, dates. No customer data, no payloads.
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) between 1 and 1000),
  check ((status = 'OPEN') = (resolved_at is null))
);
create unique index billing_findings_one_open on public.billing_reconciliation_findings(subscription_id, kind) where status = 'OPEN';
create index billing_findings_status_idx on public.billing_reconciliation_findings(status, last_seen_at desc);
alter table public.billing_reconciliation_findings enable row level security;
create policy billing_findings_admin_select on public.billing_reconciliation_findings for select to authenticated
  using (private.has_role('ADMIN', true));
revoke all on public.billing_reconciliation_findings from anon, authenticated;
grant select on public.billing_reconciliation_findings to authenticated;

-- service_role only: the server calls these after verifying an ADMIN session.
create function public.record_billing_finding(p_subscription uuid, p_kind text, p_detail jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.billing_reconciliation_findings(subscription_id, kind, detail)
  values (p_subscription, p_kind, coalesce(p_detail, '{}'::jsonb))
  on conflict (subscription_id, kind) where status = 'OPEN'
  do update set last_seen_at = now(), detail = excluded.detail
  returning id into v_id;
  return v_id;
end $$;

-- A re-check that no longer sees the discrepancy closes it (the evidence is the new check, not a person).
create function public.clear_billing_findings(p_subscription uuid, p_still_present text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.billing_reconciliation_findings
    set status = 'RESOLVED', resolved_at = now(), resolution_note = 'Cleared by a later reconciliation check.'
  where subscription_id = p_subscription and status = 'OPEN' and not (kind = any (coalesce(p_still_present, '{}')));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.record_billing_reconciliation_run(p_actor uuid, p_checked integer, p_findings integer, p_errors integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (p_actor, 'BILLING_RECONCILIATION_RUN', 'billing_reconciliation', null,
    jsonb_build_object('checked', p_checked, 'findings', p_findings, 'provider_errors', p_errors));
$$;

create function public.resolve_billing_finding(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.billing_reconciliation_findings;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) not between 1 and 1000 then
    raise exception 'Resolution note required' using errcode = '23514';
  end if;
  select * into f from public.billing_reconciliation_findings where id = p_id for update;
  if not found then raise exception 'finding not found' using errcode = '23503'; end if;
  if f.status = 'RESOLVED' then return; end if;
  update public.billing_reconciliation_findings
    set status = 'RESOLVED', resolved_at = now(), resolved_by_user_id = auth.uid(), resolution_note = btrim(p_note)
  where id = p_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'BILLING_FINDING_RESOLVED', 'billing_reconciliation_findings', p_id,
    jsonb_build_object('kind', f.kind, 'subscription_id', f.subscription_id));
end $$;

revoke all on function public.record_billing_finding(uuid, text, jsonb), public.clear_billing_findings(uuid, text[]),
  public.record_billing_reconciliation_run(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_billing_finding(uuid, text, jsonb), public.clear_billing_findings(uuid, text[]),
  public.record_billing_reconciliation_run(uuid, integer, integer, integer) to service_role;
revoke all on function public.resolve_billing_finding(uuid, text) from public, anon;
grant execute on function public.resolve_billing_finding(uuid, text) to authenticated;
