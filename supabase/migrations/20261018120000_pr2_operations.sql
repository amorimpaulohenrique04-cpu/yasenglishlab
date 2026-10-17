-- PR2 / Block 2C: operational incidents, internal support tickets, versioned legal documents + consent.
-- No contact channel, legal text or retention period is invented here: tickets are internal, documents are
-- published by an Admin only when real approved text exists, and nothing is deleted by this migration.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Incidents (alerts with a lifecycle)
-- ---------------------------------------------------------------------------------------------------------
create table public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  kind text not null check (kind in ('BILLING_DISCREPANCY', 'REVIEW_OVERDUE', 'NOTIFICATION_FAILED')),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  title text not null check (char_length(title) between 1 and 200),
  source_path text not null check (source_path ~ '^/admin/[a-z/-]*$'),
  assignee_user_id uuid references auth.users(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) between 1 and 1000),
  check ((status = 'RESOLVED') = (resolved_at is not null)),
  check (status <> 'RESOLVED' or (resolved_at is not null and resolution_note is not null))
);
-- One live incident per condition; a resolved one does not block a new one if the condition returns.
create unique index operational_incidents_live_key on public.operational_incidents(dedupe_key) where status <> 'RESOLVED';
create index operational_incidents_status_idx on public.operational_incidents(status, severity, last_seen_at desc);
alter table public.operational_incidents enable row level security;
create policy operational_incidents_admin_select on public.operational_incidents for select to authenticated
  using (private.has_role('ADMIN', true));
revoke all on public.operational_incidents from anon, authenticated;
grant select on public.operational_incidents to authenticated;

-- Recomputes the live incidents from the source tables. Idempotent: the same conditions never create a
-- second incident, and a condition that cleared is closed by the system with that as its evidence.
create function public.sync_operational_incidents() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_opened integer := 0; v_closed integer := 0;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  drop table if exists pg_temp.current_incidents;
  create temporary table current_incidents on commit drop as
    select 'BILLING_DISCREPANCY'::text as kind, 'billing:' || f.id::text as dedupe_key,
           case when f.kind in ('PROVIDER_ENDED_LOCAL_ACTIVE', 'LOCAL_ENDED_PROVIDER_ACTIVE') then 'HIGH' else 'MEDIUM' end as severity,
           'Divergência de cobrança com o provedor'::text as title, '/admin/billing'::text as source_path
    from public.billing_reconciliation_findings f where f.status = 'OPEN'
    union all
    select 'REVIEW_OVERDUE', 'review:' || c.id::text,
           case when c.state_changed_at < now() - interval '48 hours' then 'HIGH' else 'MEDIUM' end,
           'Revisão de nivelamento passou de 24 horas', '/admin/enrollments'
    from public.placement_cases c where c.state = 'REVIEW_PENDING' and c.state_changed_at < now() - interval '24 hours'
    union all
    select 'NOTIFICATION_FAILED', 'notifications:failed', 'MEDIUM',
           'Há envios de notificação que falharam', '/admin/billing'
    where exists (select 1 from public.notification_deliveries d where d.status = 'FAILED');

  with opened as (
    insert into public.operational_incidents(dedupe_key, kind, severity, title, source_path)
    select dedupe_key, kind, severity, title, source_path from pg_temp.current_incidents
    on conflict (dedupe_key) where status <> 'RESOLVED'
    do update set last_seen_at = now(), severity = excluded.severity
    returning (xmax = 0) as inserted
  ) select count(*) filter (where inserted) into v_opened from opened;

  update public.operational_incidents i
    set status = 'RESOLVED', resolved_at = now(), resolution_note = 'The condition cleared on a later check.'
  where i.status <> 'RESOLVED' and not exists (select 1 from pg_temp.current_incidents c where c.dedupe_key = i.dedupe_key);
  get diagnostics v_closed = row_count;
  return jsonb_build_object('opened', v_opened, 'closed', v_closed);
end $$;

create function public.acknowledge_operational_incident(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  update public.operational_incidents set status = 'ACKNOWLEDGED', assignee_user_id = auth.uid()
    where id = p_id and status = 'OPEN';
  if found then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'INCIDENT_ACKNOWLEDGED', 'operational_incidents', p_id, '{}');
  end if;
end $$;

-- Resolving by hand needs written evidence (what was checked or done), not just a click.
create function public.resolve_operational_incident(p_id uuid, p_evidence text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_evidence is null or char_length(btrim(p_evidence)) not between 10 and 1000 then
    raise exception 'Evidence of 10 to 1000 characters required' using errcode = '23514';
  end if;
  update public.operational_incidents
    set status = 'RESOLVED', resolved_at = now(), resolved_by_user_id = auth.uid(), resolution_note = btrim(p_evidence)
    where id = p_id and status <> 'RESOLVED';
  if found then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'INCIDENT_RESOLVED', 'operational_incidents', p_id, '{}');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Internal support tickets
-- ---------------------------------------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('PAYMENT', 'ACCESS', 'CLASSES', 'ACCOUNT', 'OTHER')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
  admin_note text check (admin_note is null or char_length(btrim(admin_note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets(status, created_at);
alter table public.support_tickets enable row level security;
create policy support_tickets_owner_or_admin on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('ADMIN', true));
revoke all on public.support_tickets from anon, authenticated;
grant select on public.support_tickets to authenticated;

create function public.open_support_ticket(p_category text, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('support:' || auth.uid()::text, 0));
  -- Simple abuse bound: at most 5 unresolved tickets per person.
  if (select count(*) from public.support_tickets where user_id = auth.uid() and status <> 'RESOLVED') >= 5 then
    raise exception 'Too many open tickets' using errcode = '54000';
  end if;
  insert into public.support_tickets(user_id, category, subject, body)
  values (auth.uid(), p_category, btrim(p_subject), btrim(p_body)) returning id into v_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'SUPPORT_TICKET_OPENED', 'support_tickets', v_id, jsonb_build_object('category', p_category));
  return v_id;
end $$;

create function public.update_support_ticket(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_status not in ('OPEN', 'IN_PROGRESS', 'RESOLVED') then
    raise exception 'invalid status' using errcode = '23514';
  end if;
  update public.support_tickets set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
    where id = p_id;
  if not found then raise exception 'ticket not found' using errcode = '23503'; end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'SUPPORT_TICKET_UPDATED', 'support_tickets', p_id, jsonb_build_object('status', p_status));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Versioned legal documents and consent records
-- ---------------------------------------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('TERMS', 'PRIVACY')),
  version text not null check (char_length(btrim(version)) between 1 and 40),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(btrim(body)) between 1 and 200000),
  published_by_user_id uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (kind, version)
);
alter table public.legal_documents enable row level security;
create policy legal_documents_read on public.legal_documents for select to authenticated using (true);
revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to authenticated;
-- A published version is immutable: a correction is a new version, never a silent edit.
create function private.legal_document_immutable() returns trigger language plpgsql as $$
begin raise exception 'Legal documents are immutable; publish a new version' using errcode = '23514'; end $$;
create trigger legal_document_immutable before update or delete on public.legal_documents
  for each row execute function private.legal_document_immutable();
revoke all on function private.legal_document_immutable() from public, anon, authenticated;

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  document_id uuid not null references public.legal_documents(id) on delete restrict,
  context text not null check (context in ('SIGNUP', 'PROFILE', 'CHECKOUT')),
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);
alter table public.user_consents enable row level security;
create policy user_consents_owner_or_admin on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('ADMIN', true));
revoke all on public.user_consents from anon, authenticated;
grant select on public.user_consents to authenticated;

create function public.publish_legal_document(p_kind text, p_version text, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  insert into public.legal_documents(kind, version, title, body, published_by_user_id)
  values (p_kind, btrim(p_version), btrim(p_title), p_body, auth.uid()) returning id into v_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'LEGAL_DOCUMENT_PUBLISHED', 'legal_documents', v_id, jsonb_build_object('kind', p_kind, 'version', p_version));
  return v_id;
end $$;

create function public.accept_legal_document(p_document uuid, p_context text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.legal_documents where id = p_document) then
    raise exception 'document not found' using errcode = '23503';
  end if;
  insert into public.user_consents(user_id, document_id, context) values (auth.uid(), p_document, p_context)
  on conflict (user_id, document_id) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.user_consents where user_id = auth.uid() and document_id = p_document;
  end if;
  return v_id;
end $$;

revoke all on function public.sync_operational_incidents(), public.acknowledge_operational_incident(uuid),
  public.resolve_operational_incident(uuid, text), public.open_support_ticket(text, text, text),
  public.update_support_ticket(uuid, text, text), public.publish_legal_document(text, text, text, text),
  public.accept_legal_document(uuid, text) from public, anon;
grant execute on function public.sync_operational_incidents(), public.acknowledge_operational_incident(uuid),
  public.resolve_operational_incident(uuid, text), public.open_support_ticket(text, text, text),
  public.update_support_ticket(uuid, text, text), public.publish_legal_document(text, text, text, text),
  public.accept_legal_document(uuid, text) to authenticated;
