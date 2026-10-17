-- PR1 / Block 1F: a Teacher may ask for a new placement test with a justification. This only records
-- the request (append-only history; the previous result is never replaced) for Admin follow-up.
-- It never starts a test, never changes the Student's course/cohort and encodes no mandatory interval:
-- the periodicity and criteria are still a pedagogical decision (docs/OPEN_QUESTIONS.md).
create table public.reassessment_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) between 1 and 1000),
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'OPEN') = (resolved_at is null))
);
create unique index reassessment_one_open_per_student on public.reassessment_requests(student_user_id) where status = 'OPEN';
create index reassessment_requests_student_idx on public.reassessment_requests(student_user_id, created_at desc);
alter table public.reassessment_requests enable row level security;
create policy reassessment_staff_select on public.reassessment_requests for select to authenticated
  using (private.has_role('ADMIN', true) or private.is_teacher_assigned(student_user_id));
revoke all on public.reassessment_requests from anon, authenticated;
grant select on public.reassessment_requests to authenticated;

create function public.request_reassessment(p_student uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.has_role('TEACHER', true) or not private.is_teacher_assigned(p_student) then
    raise exception 'Assigned Teacher aal2 required' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Justification of 10 to 1000 characters required' using errcode = '23514';
  end if;
  -- Serialise per student so two clicks cannot create two open requests.
  perform pg_advisory_xact_lock(hashtextextended('reassessment:' || p_student::text, 0));
  select id into v_id from public.reassessment_requests where student_user_id = p_student and status = 'OPEN';
  if found then return v_id; end if;
  insert into public.reassessment_requests(student_user_id, requested_by_user_id, reason)
  values (p_student, auth.uid(), btrim(p_reason)) returning id into v_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'REASSESSMENT_REQUESTED', 'reassessment_requests', v_id, jsonb_build_object('student_user_id', p_student));
  return v_id;
end $$;

create function public.resolve_reassessment(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reassessment_requests;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) not between 1 and 1000 then
    raise exception 'Resolution note required' using errcode = '23514';
  end if;
  select * into r from public.reassessment_requests where id = p_id for update;
  if not found then raise exception 'request not found' using errcode = '23503'; end if;
  if r.status = 'RESOLVED' then return; end if;
  update public.reassessment_requests
    set status = 'RESOLVED', resolution_note = btrim(p_note), resolved_by_user_id = auth.uid(), resolved_at = now()
  where id = p_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'REASSESSMENT_RESOLVED', 'reassessment_requests', p_id, '{}');
end $$;
revoke all on function public.request_reassessment(uuid, text), public.resolve_reassessment(uuid, text) from public, anon;
grant execute on function public.request_reassessment(uuid, text), public.resolve_reassessment(uuid, text) to authenticated;
