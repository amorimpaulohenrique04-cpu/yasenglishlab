-- Stage 06a: enrollment integrity (ADR 0015 decisions 3 and 4).
--
-- Additive, no data mutation at upgrade time:
--   * enrollments.status allows ACTIVE | COMPLETED | CANCELLED (domain contracts). A cross-course transfer closes
--     the previous course as CANCELLED: COMPLETED would falsely claim the course was finished (and requires
--     completed_at); there is no PAUSED state. lesson_progress, memberships (as LEFT) and audit are preserved.
--   * transfer_placement_cohort: same signature/grants/search_path; closes the previous enrollment only when
--     the target course differs, in the same transaction. Retries with the same operation_id return before any
--     write (placement_transfers.operation_id), so closure is never re-applied. Same-course transfers are unchanged.
--   * Reopening a non-ACTIVE enrollment (transfer back, or confirm_placement_choice) is now audited
--     ('enrollment_reactivated', no PII) through private.activate_enrollment.
--   * lesson_progress writes by the Student themself require an ACTIVE cohort membership bound to the enrollment
--     (errcode 42501, message 'active cohort membership required'). Staff and jobs (auth.uid() null) are exempt;
--     users without enrollment are still rejected earlier by record_lesson_progress.
--   * Legacy Students (ACTIVE enrollment, no ACTIVE membership) are intentionally NOT backfilled here: choosing a
--     cohort for them would be inferring production data. They are blocked explicitly from recording progress until
--     an Admin places them in a cohort. Detect them with:
--       select e.* from public.enrollments e where e.status = 'ACTIVE' and not exists (
--         select 1 from public.cohort_memberships m where m.enrollment_id = e.id and m.status = 'ACTIVE');

create function private.activate_enrollment(p_user uuid, p_course uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_id uuid;
  previous_status text;
begin
  select id, status into enrollment_id, previous_status
    from public.enrollments where user_id = p_user and course_id = p_course for update;
  if enrollment_id is null then
    insert into public.enrollments(user_id, course_id, status) values (p_user, p_course, 'ACTIVE')
      on conflict (user_id, course_id) do update set status = 'ACTIVE', completed_at = null
      returning id into enrollment_id;
    return enrollment_id;
  end if;
  if previous_status <> 'ACTIVE' then
    update public.enrollments set status = 'ACTIVE', completed_at = null where id = enrollment_id;
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
      values (auth.uid(), 'enrollment_reactivated', 'enrollment', enrollment_id,
        jsonb_build_object('previous_status', previous_status, 'course_id', p_course, 'source', p_source));
  end if;
  return enrollment_id;
end;
$$;
revoke all on function private.activate_enrollment(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.confirm_placement_choice(p_cohort_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; d public.placement_decisions; co public.cohorts; e uuid; m uuid;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 select * into d from public.placement_decisions where placement_case_id=c.id;
 if d.id is not null then
  if d.chosen_cohort_id is distinct from p_cohort_id then raise exception 'conflicting placement choice' using errcode='23514'; end if;return d.membership_id;
 end if;
 if c.state<>'STUDENT_DECISION' then raise exception 'student decision required' using errcode='23514'; end if;
 select * into co from public.cohorts where id=p_cohort_id for update;
 if co.id is null or not private.placement_cohort_compatible(c.id,co.id,true) then raise exception 'cohort incompatible' using errcode='23514'; end if;
 if not exists(select 1 from public.subscriptions where id=c.subscription_id and user_id=c.user_id and status='ACTIVE' and started_at<=now() and (ended_at is null or ended_at>now()) and (current_period_start is null or current_period_start<=now()) and (current_period_end is null or current_period_end>now())) then raise exception 'confirmed commercial state required' using errcode='42501'; end if;
 e:=private.activate_enrollment(c.user_id,co.course_id,'confirm_placement_choice');
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(co.id,c.user_id,e) returning id into m;
 insert into public.placement_decisions(placement_case_id,chosen_cohort_id,chosen_course_id,membership_id) values(c.id,co.id,co.course_id,m);
 update public.placement_cases set state='ENROLLED',membership_id=m where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_choice_confirmed','placement_case',c.id,jsonb_build_object('membership_id',m,'cohort_id',co.id));
 return m;
end $$;
revoke all on function public.confirm_placement_choice(uuid) from public, anon, authenticated;
grant execute on function public.confirm_placement_choice(uuid) to authenticated;

create or replace function public.transfer_placement_cohort(
  p_case_id uuid,
  p_cohort_id uuid,
  p_operation_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  placement public.placement_cases;
  prior_membership public.cohort_memberships;
  target_cohort public.cohorts;
  prior_transfer public.placement_transfers;
  prior_course uuid;
  target_enrollment uuid;
  target_membership uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_operation_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'operation and reason required' using errcode = '23514';
  end if;
  select * into placement from public.placement_cases where id = p_case_id for update;
  if placement.id is null or placement.state <> 'ENROLLED' then
    raise exception 'enrolled placement required' using errcode = '23514';
  end if;
  select * into prior_transfer from public.placement_transfers where operation_id = p_operation_id;
  if prior_transfer.operation_id is not null then
    if row(prior_transfer.placement_case_id, prior_transfer.target_cohort_id,
      prior_transfer.actor_user_id, prior_transfer.reason)
      is distinct from row(placement.id, p_cohort_id, auth.uid(), btrim(p_reason)) then
      raise exception 'conflicting transfer retry' using errcode = '23514';
    end if;
    return prior_transfer.membership_id;
  end if;
  select * into prior_membership from public.cohort_memberships where id = placement.membership_id;
  perform 1 from public.cohorts where id in (prior_membership.cohort_id, p_cohort_id) order by id for update;
  select * into target_cohort from public.cohorts where id = p_cohort_id;
  if target_cohort.id = prior_membership.cohort_id
    or not private.placement_cohort_compatible(placement.id, p_cohort_id, false) then
    raise exception 'transfer cohort incompatible' using errcode = '23514';
  end if;
  target_enrollment := private.activate_enrollment(placement.user_id, target_cohort.course_id, 'transfer_placement_cohort');

  insert into public.cohort_memberships(cohort_id, user_id, enrollment_id)
    values (target_cohort.id, placement.user_id, target_enrollment)
    returning id into target_membership;
  update public.placement_cases set membership_id = target_membership where id = placement.id;
  update public.cohort_memberships set status = 'LEFT', ends_at = clock_timestamp()
    where id = prior_membership.id;

  -- Cross-course transfer: the previous course enrollment ends in the same transaction (progress is kept).
  select course_id into prior_course from public.enrollments where id = prior_membership.enrollment_id;
  if prior_course is distinct from target_cohort.course_id then
    update public.cohort_memberships set status = 'LEFT', ends_at = clock_timestamp()
      where enrollment_id = prior_membership.enrollment_id and status = 'ACTIVE';
    update public.enrollments set status = 'CANCELLED'
      where id = prior_membership.enrollment_id and status = 'ACTIVE';
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
      values (auth.uid(), 'enrollment_closed_on_transfer', 'enrollment', prior_membership.enrollment_id,
        jsonb_build_object('operation_id', p_operation_id, 'course_id', prior_course,
          'new_status', 'CANCELLED', 'placement_case_id', placement.id));
  end if;

  insert into public.placement_transfers(operation_id, placement_case_id, target_cohort_id,
    prior_membership_id, membership_id, actor_user_id, reason)
    values (p_operation_id, placement.id, target_cohort.id, prior_membership.id,
      target_membership, auth.uid(), btrim(p_reason));
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'placement_cohort_transferred', 'placement_case', placement.id,
      jsonb_build_object('operation_id', p_operation_id, 'membership_id', target_membership));
  return target_membership;
end;
$$;
revoke all on function public.transfer_placement_cohort(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_placement_cohort(uuid, uuid, uuid, text) to authenticated;

-- Student progress writes need an ACTIVE cohort membership. Sorts after access_00_ so a suspended Student
-- still gets the subscription error first.
create function private.enforce_active_cohort_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    return new;
  end if;
  if exists (select 1 from public.user_roles ur
    where ur.user_id = new.user_id and ur.role in ('ADMIN', 'TEACHER', 'SUPPORT')) then
    return new;
  end if;
  if not exists (select 1 from public.cohort_memberships m
    where m.user_id = new.user_id and m.enrollment_id = new.enrollment_id and m.status = 'ACTIVE') then
    raise exception 'active cohort membership required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_active_cohort_membership() from public, anon, authenticated;

create trigger access_01_cohort_membership_gate before insert or update on public.lesson_progress
  for each row execute function private.enforce_active_cohort_membership();
