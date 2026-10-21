-- Formal pedagogical levels are opt-in; NULL retains historical behavior.
-- No production cohorts, enrollments, progress or recommendations are backfilled.
alter table public.cohorts add column pedagogical_level text
  check (pedagogical_level in ('BASIC','INTERMEDIATE','ADVANCED'));
alter table public.placement_cases
  add column recommended_level_override text check (recommended_level_override in ('BASIC','INTERMEDIATE','ADVANCED')),
  add column level_override_reason text check (char_length(btrim(level_override_reason)) between 1 and 1000);
alter table public.placement_reviews add column recommended_level text
  check (recommended_level in ('BASIC','INTERMEDIATE','ADVANCED'));
alter table public.cohort_practice_assignments
  add column available_from timestamptz,
  add column require_lesson_available boolean not null default false,
  add constraint practice_release_finite check (available_from is null or isfinite(available_from));

-- Cohort classification is structural once students have history. Configure before enrollment.
create function private.guard_cohort_level() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.pedagogical_level is distinct from old.pedagogical_level
     and exists(select 1 from public.cohort_memberships where cohort_id=old.id) then
    raise exception 'Cohort level with membership history is immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger cohort_level_guard before update on public.cohorts
for each row execute function private.guard_cohort_level();

-- All writers serialize on the enrollment (one user/course), including direct trusted SQL.
-- Legacy overlapping paths remain supported, but cannot be mixed with a formal level.
create function private.guard_level_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare level text;
begin
  -- Deferred events inspect the final row, including an old membership retired by transfer.
  select * into new from public.cohort_memberships where id=new.id;
  if not found or new.status<>'ACTIVE' then return new; end if;
  perform 1 from public.enrollments where id=new.enrollment_id for no key update;
  select pedagogical_level into level from public.cohorts where id=new.cohort_id for share;
  if exists(select 1 from public.cohort_memberships m join public.cohorts c on c.id=m.cohort_id
    where m.enrollment_id=new.enrollment_id and m.id<>new.id and m.status='ACTIVE'
      and tstzrange(m.starts_at,m.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
      and (level is not null or c.pedagogical_level is not null)) then
    raise exception 'Conflicting course cohort membership' using errcode='23514';
  end if;
  return new;
end $$;
create constraint trigger membership_level_guard after insert or update on public.cohort_memberships
deferrable initially immediate
for each row execute function private.guard_level_membership();
revoke all on function private.guard_cohort_level(),private.guard_level_membership() from public,anon,authenticated;

create or replace function public.manage_cohort(p_operation text,p_cohort_id uuid,p_input jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid:=p_cohort_id; linked_enrollment uuid; prior_level text;
begin
 if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN with aal2 required' using errcode='42501'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'cohort input must be object' using errcode='23514'; end if;
 if p_operation='CREATE' then
  insert into public.cohorts(course_id,name,code,timezone,starts_at,ends_at,pedagogical_level) values(
   (p_input->>'course_id')::uuid,p_input->>'name',p_input->>'code',coalesce(p_input->>'timezone','America/Recife'),
   case when length(p_input->>'starts_at')=10 then (p_input->>'starts_at')::timestamp at time zone coalesce(p_input->>'timezone','America/Recife') else (p_input->>'starts_at')::timestamptz end,
   case when length(p_input->>'ends_at')=10 then (p_input->>'ends_at')::timestamp at time zone coalesce(p_input->>'timezone','America/Recife') else (p_input->>'ends_at')::timestamptz end, nullif(p_input->>'pedagogical_level','')) returning id into target;
 else
  perform 1 from public.cohorts where id=target for update;
  if not found then raise exception 'cohort not found' using errcode='23503'; end if;
  select pedagogical_level into prior_level from public.cohorts where id=target;
  case p_operation
  when 'EDIT' then update public.cohorts set name=coalesce(p_input->>'name',name),timezone=coalesce(p_input->>'timezone',timezone),
    pedagogical_level=case when p_input ? 'pedagogical_level' then nullif(p_input->>'pedagogical_level','') else pedagogical_level end where id=target;
  when 'STATUS' then update public.cohorts set status=p_input->>'status' where id=target;
  when 'ADD_STUDENT' then
   select e.id into linked_enrollment from public.enrollments e join public.cohorts c on c.course_id=e.course_id
    where c.id=target and e.user_id=(p_input->>'user_id')::uuid and e.status='ACTIVE' order by e.created_at desc limit 1;
   if linked_enrollment is null then raise exception 'active compatible enrollment required' using errcode='23514'; end if;
   insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(target,(p_input->>'user_id')::uuid,linked_enrollment)
    on conflict(cohort_id,user_id) where status='ACTIVE' do nothing;
  when 'REMOVE_STUDENT' then update public.cohort_memberships set status='LEFT',ends_at=clock_timestamp()
    where cohort_id=target and user_id=(p_input->>'user_id')::uuid and status='ACTIVE';
  when 'ADD_TEACHER' then insert into public.cohort_teachers(cohort_id,teacher_id,is_primary)
    values(target,(p_input->>'teacher_id')::uuid,coalesce((p_input->>'is_primary')::boolean,false))
    on conflict(cohort_id,teacher_id) where ends_at is null do nothing;
  when 'REMOVE_TEACHER' then update public.cohort_teachers set ends_at=clock_timestamp()
    where cohort_id=target and teacher_id=(p_input->>'teacher_id')::uuid and ends_at is null;
  else raise exception 'unsupported cohort operation' using errcode='23514';
  end case;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
  values(auth.uid(),'cohort_'||lower(p_operation),'cohort',target,jsonb_build_object('operation',p_operation,'previous_level',prior_level,'pedagogical_level',(select pedagogical_level from public.cohorts where id=target)));
 return target;
end $$;

create or replace function public.admin_cohort_directory(
  p_limit integer default 25,
  p_offset integer default 0,
  p_query text default null
)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN with aal2 required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset not between 0 and 10000
    or char_length(coalesce(p_query, '')) > 120 then
    raise exception 'invalid cohort directory bounds' using errcode = '22023';
  end if;

  return query
  select jsonb_build_object(
    'id', c.id,
    'course_id', c.course_id,
    'pedagogical_level', c.pedagogical_level,
    'course_title', course.title,
    'name', c.name,
    'code', c.code,
    'status', c.status,
    'timezone', c.timezone,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'capacity', settings.capacity,
    'schedule', settings.schedule,
    'occupancy', coalesce(members.occupancy, 0),
    'student_count', coalesce(members.student_count, 0),
    'students', coalesce(members.students, '[]'::jsonb),
    'teachers', coalesce(teachers.teachers, '[]'::jsonb),
    'next_sessions', coalesce(sessions.next_sessions, '[]'::jsonb)
  )
  from public.cohorts c
  join public.courses course on course.id = c.course_id
  left join public.cohort_placement_settings settings on settings.cohort_id = c.id
  left join lateral (
    select count(*) filter (where m.status = 'ACTIVE')::integer as occupancy,
      count(*)::integer as student_count,
      coalesce((
        select jsonb_agg(jsonb_build_object('user_id', roster.user_id, 'name', roster.display_name)
          order by roster.display_name, roster.user_id)
        from (
          select m2.user_id, p.display_name
          from public.cohort_memberships m2
          join public.profiles p on p.user_id = m2.user_id
          where m2.cohort_id = c.id and m2.status = 'ACTIVE'
          order by p.display_name, m2.user_id limit 20
        ) roster
      ), '[]'::jsonb) as students
    from public.cohort_memberships m
    where m.cohort_id = c.id and m.status = 'ACTIVE'
  ) members on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'teacher_id', bounded.teacher_id,
      'name', bounded.display_name,
      'is_primary', bounded.is_primary
    ) order by bounded.is_primary desc, bounded.display_name), '[]'::jsonb) as teachers
    from (
      select ct.teacher_id, p.display_name, ct.is_primary
      from public.cohort_teachers ct
      join public.teachers t on t.id = ct.teacher_id
      join public.profiles p on p.user_id = t.user_id
      where ct.cohort_id = c.id and ct.ends_at is null
      order by ct.is_primary desc, p.display_name limit 10
    ) bounded
  ) teachers on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', bounded.id, 'title', bounded.title,
      'starts_at', bounded.starts_at, 'ends_at', bounded.ends_at
    ) order by bounded.starts_at), '[]'::jsonb) as next_sessions
    from (
      select s.id, s.title, s.starts_at, s.ends_at
      from public.live_sessions s
      where s.cohort_id = c.id and s.starts_at >= now()
        and s.status = 'SCHEDULED'
      order by s.starts_at, s.id limit 3
    ) bounded
  ) sessions on true
  where p_query is null or c.name ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    or c.code ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    or course.title ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
  order by c.starts_at desc, c.id
  limit p_limit offset p_offset;
end;
$$;

drop function public.finalize_placement_review(uuid,uuid,text,text);
create or replace function public.finalize_placement_review(p_case_id uuid,p_course_id uuid,p_feedback text,p_confidence text,p_level text default null,p_admin_reason text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; r public.placement_reviews;
begin
 if p_admin_reason is not null then
  if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN aal2 required' using errcode='42501'; end if;
  if p_level is null or char_length(btrim(p_admin_reason)) not between 1 and 1000 then raise exception 'Level and override reason required' using errcode='23514'; end if;
  select * into c from public.placement_cases where id=p_case_id for update;
  select * into r from public.placement_reviews where placement_case_id=c.id;
  if c.id is null or c.state not in ('PLACEMENT_READY','STUDENT_DECISION') or r.id is null
    or row(r.recommended_course_id,r.feedback,r.confidence) is distinct from row(p_course_id,btrim(p_feedback),p_confidence) then
    raise exception 'Finalized review before student choice required' using errcode='23514'; end if;
  if row(c.recommended_level_override,c.level_override_reason) is not distinct from row(p_level,btrim(p_admin_reason)) then return r.id; end if;
  update public.placement_cases set recommended_level_override=p_level,level_override_reason=btrim(p_admin_reason) where id=c.id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
    values(auth.uid(),'placement_level_overridden','placement_case',c.id,jsonb_build_object('review_id',r.id,
      'previous_level',coalesce(c.recommended_level_override,r.recommended_level),'level',p_level,'reason',btrim(p_admin_reason)));
  return r.id;
 end if;
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 select * into c from public.placement_cases where id=p_case_id for update;
 if c.id is null or not private.is_teacher_assigned(c.user_id) then raise exception 'Teacher scope required' using errcode='42501'; end if;
 select * into r from public.placement_reviews where placement_case_id=c.id;
 if r.id is not null then
  if row(r.actor_user_id,r.recommended_course_id,r.feedback,r.confidence,r.recommended_level) is distinct from row(auth.uid(),p_course_id,btrim(p_feedback),p_confidence,p_level) then raise exception 'conflicting finalized review' using errcode='23514'; end if;
  return r.id;
 end if;
 if c.state<>'REVIEW_PENDING' then raise exception 'review pending required' using errcode='23514'; end if;
 if not exists(select 1 from public.courses where id=p_course_id and active and publication_status='PUBLISHED') then raise exception 'published operational track required' using errcode='23514'; end if;
 if p_level is null and exists(select 1 from public.cohorts where course_id=p_course_id and pedagogical_level is not null and status<>'ARCHIVED') then raise exception 'Pedagogical level required for this course' using errcode='23514'; end if;
 insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,recommended_level,provenance) values(c.id,p_course_id,auth.uid(),btrim(p_feedback),p_confidence,p_level,jsonb_build_object('method','teacher-placement-v1','assessment_attempt_id',c.assessment_attempt_id,'official_cefr',false)) returning id into r.id;
 update public.placement_cases set state='PLACEMENT_READY' where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_review_finalized','placement_case',c.id,jsonb_build_object('review_id',r.id,'course_id',p_course_id,'recommended_level',p_level));
 return r.id;
end $$;
revoke all on function public.finalize_placement_review(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_placement_review(uuid,uuid,text,text,text,text) to authenticated;

create or replace function private.placement_cohort_compatible(p_case_id uuid, p_cohort_id uuid, p_require_track boolean default true)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.cohorts co
 join public.courses course on course.id = co.course_id
 join public.cohort_placement_settings settings on settings.cohort_id = co.id
 join public.placement_reviews r on r.placement_case_id = p_case_id
 where co.id = p_cohort_id and co.status = 'ACTIVE' and (co.ends_at is null or co.ends_at > now())
 and course.active and course.publication_status = 'PUBLISHED'
 and (not p_require_track or co.course_id = r.recommended_course_id)
 and (not p_require_track or co.pedagogical_level is not distinct from coalesce((select recommended_level_override from public.placement_cases where id=p_case_id),r.recommended_level))
 and not exists(
  select 1 from jsonb_array_elements(settings.schedule) w
  cross join lateral (
   select (now() at time zone co.timezone)::date
    + (((w->>'weekday')::integer - extract(dow from (now() at time zone co.timezone))::integer + 7) % 7) as d
  ) occ
  cross join lateral (
   select (occ.d + make_interval(mins => (w->>'startMinute')::integer)) at time zone co.timezone as starts_at,
          (w->>'endMinute')::integer - (w->>'startMinute')::integer as minutes
  ) t
  where not exists(
   select 1 from public.student_schedule_preferences pref
   cross join lateral (select t.starts_at at time zone pref.timezone as local_start) l
   where pref.placement_case_id = p_case_id
    and pref.weekday = extract(dow from l.local_start)::integer
    and pref.start_minute <= extract(hour from l.local_start)::integer * 60 + extract(minute from l.local_start)::integer
    and pref.end_minute >= extract(hour from l.local_start)::integer * 60 + extract(minute from l.local_start)::integer + t.minutes
  )));
$$;

CREATE OR REPLACE FUNCTION public.get_placement_candidates(p_case_id uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.placement_cases;
begin
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or auth.uid() is null or not private.can_read_placement(c.user_id) then raise exception 'placement scope required' using errcode='42501'; end if;
 if c.state not in ('PLACEMENT_READY','STUDENT_DECISION','ENROLLED') then return; end if;
 return query select jsonb_build_object('id',co.id,'name',co.name,'courseId',co.course_id,'pedagogicalLevel',co.pedagogical_level,'timezone',co.timezone,'schedule',settings.schedule,'occupancy',(select count(*) from public.cohort_memberships m where m.cohort_id=co.id and m.status='ACTIVE'),'startsAt',co.starts_at)
 from public.cohorts co join public.cohort_placement_settings settings on settings.cohort_id=co.id
 where private.placement_cohort_compatible(c.id,co.id,true) order by co.starts_at,co.id;
end $function$;

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
  set constraints public.membership_level_guard deferred;
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

  set constraints public.membership_level_guard immediate;
  perform private.complete_path_enrollment(target_enrollment);

  insert into public.placement_transfers(operation_id, placement_case_id, target_cohort_id,
    prior_membership_id, membership_id, actor_user_id, reason)
    values (p_operation_id, placement.id, target_cohort.id, prior_membership.id,
      target_membership, auth.uid(), btrim(p_reason));
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'placement_cohort_transferred', 'placement_case', placement.id,
      jsonb_build_object('operation_id', p_operation_id, 'membership_id', target_membership, 'reason', btrim(p_reason),
        'previous_cohort_id', prior_membership.cohort_id, 'pedagogical_level', target_cohort.pedagogical_level));
  return target_membership;
end;
$$;

create or replace function private.complete_path_enrollment(p_enrollment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_total integer;
  v_done integer;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment for no key update;
  if v_enrollment.id is null or v_enrollment.status <> 'ACTIVE' then
    return;
  end if;

  -- Only the final formal level may complete the shared course. No membership is not final.
  if exists(select 1 from private.student_course_cohorts(v_enrollment.user_id,v_enrollment.course_id) c(id) join public.cohorts co on co.id=c.id where co.pedagogical_level is not null)
    and (not exists(select 1 from private.student_course_cohorts(v_enrollment.user_id,v_enrollment.course_id) c(id)
      join public.cohorts co on co.id=c.id where co.pedagogical_level='ADVANCED')
      or exists(select 1 from private.student_course_cohorts(v_enrollment.user_id,v_enrollment.course_id) c(id)
      join public.cohorts co on co.id=c.id where co.pedagogical_level in ('BASIC','INTERMEDIATE'))) then
    return;
  end if;

  select count(*), count(*) filter (where lp.status = 'COMPLETED')
    into v_total, v_done
  from public.modules m
  join public.lessons l on l.module_id = m.id
  left join public.lesson_progress lp on lp.enrollment_id = v_enrollment.id and lp.lesson_id = l.id
  where m.course_id = v_enrollment.course_id
    and private.content_visible('lessons', l.id)
    and private.student_path_includes('lessons',l.id,v_enrollment.user_id);

  if v_total = 0 or v_done < v_total then
    return;
  end if;

  update public.enrollments set status = 'COMPLETED', completed_at = now()
    where id = v_enrollment.id and status = 'ACTIVE';
  if found then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'enrollment_course_completed', 'enrollment', v_enrollment.id,
      jsonb_build_object('course_id', v_enrollment.course_id, 'lessons_total', v_total));
  end if;
  return;
end;
$$;

-- Relationship invariants are independent of the authoring UI and apply to trusted writers.
create function private.guard_practice_lesson_relation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.lessons where id=new.related_lesson_id for share;
  perform 1 from public.modules where id in (new.related_module_id,(select module_id from public.lessons where id=new.related_lesson_id)) for share;
  if exists(select 1 from public.cohort_practice_assignments pa join public.cohorts c on c.id=pa.cohort_id where pa.practice_activity_id=new.id and c.course_id is distinct from coalesce(new.course_id,(select m.course_id from public.modules m where m.id=coalesce(new.related_module_id,(select module_id from public.lessons where id=new.related_lesson_id))))) then
    raise exception 'Assigned practice course is immutable' using errcode='23514';
  end if;
  if new.course_id is not null and new.related_lesson_id is not null and not exists(
    select 1 from public.lessons l join public.modules m on m.id=l.module_id
    where l.id=new.related_lesson_id and m.course_id=new.course_id
      and (new.related_module_id is null or new.related_module_id=m.id)) then
    raise exception 'Related lesson must belong to practice course' using errcode='23514';
  end if;
  if new.related_lesson_id is null and exists(select 1 from public.cohort_practice_assignments
    where practice_activity_id=new.id and require_lesson_available) then
    raise exception 'Lesson required by assignment release rule' using errcode='23514';
  end if;
  return new;
end $$;
create trigger practice_lesson_relation_guard before insert or update on public.practice_activities
for each row execute function private.guard_practice_lesson_relation();

create function private.guard_practice_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.practice_activities;
begin
  select * into a from public.practice_activities where id=new.practice_activity_id for share;
  if (a.audience<>'ASSIGNED' and (new.available_from is not null or new.require_lesson_available)) then
    raise exception 'Scheduled assignments require an ASSIGNED practice' using errcode='23514';
  end if;
  if not exists(select 1 from public.cohorts c
    join private.path_content_info('practice_activities',a.id) info on info.course_id=c.course_id
    where c.id=new.cohort_id)
    or (new.require_lesson_available and a.related_lesson_id is null) then
    raise exception 'Assignment requires compatible course and lesson release rule' using errcode='23514';
  end if;
  return new;
end $$;
create trigger practice_assignment_guard before insert or update on public.cohort_practice_assignments
for each row execute function private.guard_practice_assignment();
revoke all on function private.guard_practice_lesson_relation(),private.guard_practice_assignment() from public,anon,authenticated;

create or replace function private.student_path_available(p_kind text,p_id uuid,p_user uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare info record;
begin
  if not private.student_path_includes(p_kind,p_id,p_user) then return false; end if;
  select * into info from private.path_content_info(p_kind,p_id);
  if info.audience='ASSIGNED' then
    return exists(select 1 from public.cohort_practice_assignments pa
      join public.practice_activities a on a.id=pa.practice_activity_id
      where pa.practice_activity_id=p_id
        and pa.cohort_id in (select private.student_course_cohorts(p_user,info.course_id))
        and (pa.available_from is null or pa.available_from<=now())
        and (not pa.require_lesson_available or (
          a.related_lesson_id is not null
          and private.content_visible('lessons',a.related_lesson_id)
          and private.student_path_available('lessons',a.related_lesson_id,p_user))));
  end if;
  if info.parent_id is not null and not private.student_path_available(info.parent_kind,info.parent_id,p_user) then
    return false;
  end if;
  if info.course_id is null or not exists(select 1 from private.student_course_cohorts(p_user,info.course_id)) then
    return true;
  end if;
  return exists(
    select 1 from private.student_course_cohorts(p_user,info.course_id) c(id)
      left join public.cohort_paths cp on cp.cohort_id=c.id
      left join public.cohort_path_items i on i.cohort_id=c.id and i.content_kind=p_kind and i.content_id=p_id
    where (i.content_id is not null or (coalesce(cp.mode,'DEFAULT')='DEFAULT' and info.audience='COURSE'))
      and (i.available_from is null or i.available_from<=now())
      and (p_kind<>'lessons' or not coalesce(cp.sequential,false) or not exists(
        select 1 from public.lessons previous join public.modules pm on pm.id=previous.module_id
          left join public.cohort_path_items pi on pi.cohort_id=c.id and pi.content_kind='lessons' and pi.content_id=previous.id
          join public.lessons current_lesson on current_lesson.id=p_id
          join public.modules current_module on current_module.id=current_lesson.module_id
        where pm.course_id=info.course_id and private.content_visible('lessons',previous.id)
          and ((cp.mode='CUSTOM' and pi.position<i.position)
            or (cp.mode='DEFAULT' and private.student_path_includes('lessons',previous.id,p_user)
              and row(pm.position,pm.id,previous.position,previous.id)<row(current_module.position,current_module.id,current_lesson.position,current_lesson.id)))
          and not exists(select 1 from public.lesson_progress lp where lp.user_id=p_user
            and lp.lesson_id=previous.id and lp.status='COMPLETED')
      ))
  );
end;
$$;

drop function public.teacher_practice_assign(uuid,uuid[],timestamptz,jsonb);
create or replace function public.teacher_practice_assign(p_id uuid, p_cohort_ids uuid[], p_due_at timestamptz default null,
  p_context jsonb default '{}'::jsonb, p_available_from timestamptz default null, p_require_lesson_available boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; cohort_ids uuid[]; c uuid; assigned integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if act.publication_status <> 'PUBLISHED' or not act.active or not private.content_visible('practice_activities', act.id) then
    raise exception 'Only a published practice can be assigned' using errcode = '23514';
  end if;
  if p_cohort_ids is null or cardinality(p_cohort_ids) not between 1 and 20 or exists (select 1 from unnest(p_cohort_ids) x where x is null) then
    raise exception 'Between 1 and 20 cohorts are required' using errcode = '23514';
  end if;
  if p_due_at is not null and p_due_at <= now() then
    raise exception 'Due date must be in the future' using errcode = '23514';
  end if;
  if p_available_from is not null and not isfinite(p_available_from) then raise exception 'Finite release date required' using errcode='23514'; end if;
  if p_require_lesson_available is null or (p_require_lesson_available and act.related_lesson_id is null) then
    raise exception 'Related lesson required for release rule' using errcode='23514'; end if;
  select array_agg(distinct x order by x) into cohort_ids from unnest(p_cohort_ids) x;
  foreach c in array cohort_ids loop
    if not private.is_cohort_teacher(c) then raise exception 'Cohort scope required' using errcode = '42501'; end if;
    if not exists (select 1 from public.cohorts co where co.id = c and co.course_id = act.course_id) then
      raise exception 'Cohort course does not match the practice course' using errcode = '23514';
    end if;
  end loop;
  foreach c in array cohort_ids loop
    insert into public.cohort_practice_assignments(cohort_id, practice_activity_id, assigned_by_teacher_id, due_at, available_from, require_lesson_available)
      values (c, act.id, teacher, p_due_at, p_available_from, p_require_lesson_available)
      on conflict (cohort_id, practice_activity_id) do update set due_at = excluded.due_at, available_from = excluded.available_from, require_lesson_available = excluded.require_lesson_available, assigned_by_teacher_id = excluded.assigned_by_teacher_id;
    assigned := assigned + 1;
  end loop;
  perform private.practice_audit('teacher_practice_assigned', act.id,
    jsonb_build_object('cohort_ids', to_jsonb(cohort_ids), 'due_at', p_due_at, 'available_from', p_available_from, 'require_lesson_available', p_require_lesson_available), p_context);
  return assigned;
end $$;
revoke all on function public.teacher_practice_assign(uuid,uuid[],timestamptz,jsonb,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.teacher_practice_assign(uuid,uuid[],timestamptz,jsonb,timestamptz,boolean) to authenticated;

create or replace function public.teacher_practice_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; k private.practice_answer_keys;
begin
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED';
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  select * into k from private.practice_answer_keys where practice_activity_id = act.id;
  return jsonb_build_object('id', act.id, 'title', act.title, 'skill', act.skill, 'cefrTarget', act.cefr_target,
    'difficulty', act.difficulty, 'estimatedMinutes', act.estimated_minutes, 'courseId', act.course_id,
    'relatedModuleId', act.related_module_id, 'relatedLessonId', act.related_lesson_id, 'content', act.content,
    'answerKey', coalesce(k.answer_key, '{}'::jsonb), 'feedback', coalesce(k.feedback, '{}'::jsonb),
    'itemKeys', coalesce((select jsonb_object_agg(ik.item_id, jsonb_build_object('answerKey', ik.answer_key, 'feedback', ik.feedback))
      from private.practice_item_keys ik where ik.practice_activity_id = act.id), '{}'::jsonb),
    'publicationStatus', act.publication_status, 'publishedAt', act.published_at,
    'hasAttempts', private.practice_has_attempts(act.id), 'updatedAt', act.updated_at,
    'assets', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'assetType', s.asset_type, 'uploadStatus', s.upload_status,
        'mimeType', s.metadata->>'mime_type', 'sizeBytes', s.metadata->'size_bytes', 'createdAt', s.created_at) order by s.created_at, s.id)
      from public.practice_activity_assets s where s.practice_activity_id = act.id), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('cohortId', pa.cohort_id, 'cohortName', co.name, 'dueAt', pa.due_at, 'availableFrom', pa.available_from, 'requireLessonAvailable', pa.require_lesson_available,
        'assignedAt', pa.created_at) order by pa.created_at, pa.id)
      from public.cohort_practice_assignments pa join public.cohorts co on co.id = pa.cohort_id
      where pa.practice_activity_id = act.id), '[]'::jsonb));
end $$;

create or replace function private.guard_path_content_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare before_row jsonb := to_jsonb(old); after_row jsonb := to_jsonb(new); referenced boolean;
begin
  if tg_table_name='cohorts' then
    referenced := exists(select 1 from public.cohort_path_items where cohort_id=old.id);
  else
    referenced := exists(select 1 from public.cohort_path_items where content_kind=tg_table_name and content_id=old.id);
  end if;
  if tg_table_name='lessons' then
    referenced := referenced or exists(select 1 from public.practice_activities a where a.audience='ASSIGNED' and a.related_lesson_id=old.id);
  elsif tg_table_name='modules' then
    referenced := referenced or exists(select 1 from public.practice_activities a where a.audience='ASSIGNED'
      and (a.related_module_id=old.id or exists(select 1 from public.lessons l where l.id=a.related_lesson_id and l.module_id=old.id)));
  end if;
  if referenced and (tg_op='DELETE' or
    row(before_row->'id',before_row->'course_id',before_row->'module_id',before_row->'lesson_id',before_row->'related_module_id',before_row->'related_lesson_id')
      is distinct from
    row(after_row->'id',after_row->'course_id',after_row->'module_id',after_row->'lesson_id',after_row->'related_module_id',after_row->'related_lesson_id')
    or (tg_table_name='practice_activities' and after_row->>'audience'='ASSIGNED')) then
    raise exception 'Remove cohort path references before moving or deleting content' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.get_placement_projection(p_case_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.placement_cases;
begin
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or auth.uid() is null or not private.can_read_placement(c.user_id) then raise exception 'placement scope required' using errcode='42501'; end if;
 return jsonb_build_object('displayName',(select display_name from public.profiles where user_id=c.user_id),'case',jsonb_build_object('id',c.id,'user_id',c.user_id,'state',c.state,'assessment_attempt_id',c.assessment_attempt_id,'membership_id',c.membership_id,'created_at',c.created_at,'state_changed_at',c.state_changed_at),
 'preferences',coalesce((select jsonb_agg(jsonb_build_object('timezone',timezone,'weekday',weekday,'startMinute',start_minute,'endMinute',end_minute)) from public.student_schedule_preferences where placement_case_id=c.id),'[]'::jsonb),
 'review',(select to_jsonb(r)-'actor_user_id'-'placement_case_id' from public.placement_reviews r where placement_case_id=c.id),
 'decision',(select to_jsonb(d)-'id'-'placement_case_id' from public.placement_decisions d where placement_case_id=c.id),
 'recommendedLevel',coalesce(c.recommended_level_override,(select recommended_level from public.placement_reviews where placement_case_id=c.id)),
 'recommendedTitle',(select course.title from public.placement_reviews r join public.courses course on course.id=r.recommended_course_id where r.placement_case_id=c.id),
 'chosenTitle',(select course.title from public.placement_decisions d join public.courses course on course.id=d.chosen_course_id where d.placement_case_id=c.id),
 'currentCohort',(select co.name from public.cohort_memberships m join public.cohorts co on co.id=m.cohort_id where m.id=c.membership_id),
 'assessmentSummary',(select jsonb_build_object('status',a.status,'submittedAt',a.submitted_at,'objectiveScore',(a.result_metadata->>'objective_score')::numeric,'pendingCount',(a.result_metadata->>'pending_item_count')::integer) from public.assessment_attempts a where a.id=c.assessment_attempt_id));
end $$;

-- Private practice media preserves the paid-access gate when a scheduled assignment opens.
create or replace function public.authorize_practice_asset(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.practice_activity_assets s
    join public.practice_activities a on a.id = s.practice_activity_id
    where s.id = p_asset and s.upload_status = 'READY'
      and (
        (private.has_role('TEACHER', true) and a.created_by_teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid() and t.active))
        or (a.publication_status = 'PUBLISHED'
            and (a.content #>> '{stimulus,assetId}' = s.id::text
                 or (jsonb_typeof(a.content -> 'items') = 'array' and exists (
                       select 1 from jsonb_array_elements(a.content -> 'items') i where i #>> '{stimulus,assetId}' = s.id::text)))
            and (private.has_role('ADMIN', true) or (private.has_role('STUDENT', false) and private.has_paid_access(auth.uid()) and private.can_view_practice_activity(a.id))))));
$$;
