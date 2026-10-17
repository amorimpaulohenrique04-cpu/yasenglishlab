-- Stage 13 / Phase 0 (practice-10-phase-0): Practice attempt lifecycle and lesson gating.
--
-- Additive only. Decisions (harness/goals/practice-10-phase-0.md, approved with the plan):
--  * A. A practice assigned by a Teacher to one of the Student's cohorts bypasses lesson gating.
--  * C. An IN_PROGRESS attempt with activity in the last 24 hours is resumed; older open attempts become
--       ABANDONED lazily on the next start (no cron).
--  * A practice linked to a lesson the Student has not reached cannot be started. "Reached" =
--       the lesson has a lesson_progress row for the Student (started, accessed or COMPLETED), or it is the
--       Student's current lesson (first lesson of the course, in course order, that is not COMPLETED and is
--       available in the Student's path). A module-only link is reached when any lesson of the module is.
--  * Existing history is never deleted: duplicate open attempts are marked ABANDONED, not removed.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Attempt model
-- ---------------------------------------------------------------------------------------------------------
alter table public.practice_attempts
  add column attempt_kind text not null default 'FULL'
    constraint practice_attempts_attempt_kind_check check (attempt_kind in ('FULL', 'REVIEW')),
  add column item_ids text[],
  add column last_activity_at timestamptz;

-- Backfill: the last known activity of an attempt is its submission, otherwise its start.
update public.practice_attempts
set last_activity_at = coalesce(submitted_at, started_at)
where last_activity_at is null;

alter table public.practice_attempts
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Existing duplicates: keep the most recent open attempt per (user, activity, kind), abandon the others.
-- ---------------------------------------------------------------------------------------------------------
with ranked as (
  select a.id,
         row_number() over (
           partition by a.user_id, a.practice_activity_id, a.attempt_kind
           order by a.started_at desc, a.id desc
         ) as rn
  from public.practice_attempts a
  where a.status = 'IN_PROGRESS'
)
update public.practice_attempts a
set status = 'ABANDONED'
from ranked r
where a.id = r.id and r.rn > 1;

create unique index practice_attempts_one_open_per_kind
  on public.practice_attempts (user_id, practice_activity_id, attempt_kind)
  where status = 'IN_PROGRESS';

-- ---------------------------------------------------------------------------------------------------------
-- 3. Lesson reach
-- ---------------------------------------------------------------------------------------------------------
-- The Student's current lesson in a course: the first lesson, in course order (module position, lesson
-- position), that is published, not COMPLETED and available in the Student's cohort path.
-- Mirrors orderedCourseLessons + isLessonComplete/isLessonLocked in src/modules/learning/domain/progress.ts.
create function private.student_current_lesson(p_user uuid, p_course uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec record;
begin
  if p_user is null or p_course is null then
    return null;
  end if;
  for rec in
    select l.id,
           exists (
             select 1 from public.lesson_progress lp
             where lp.user_id = p_user and lp.lesson_id = l.id and lp.status = 'COMPLETED'
           ) as completed
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where m.course_id = p_course
    order by m.position, m.id, l.position, l.id
  loop
    if rec.completed then
      continue;
    end if;
    if private.content_visible('lessons', rec.id) and private.student_path_available('lessons', rec.id, p_user) then
      return rec.id;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.student_current_lesson(uuid, uuid) from public, anon, authenticated;

-- Decision helper only (it takes an arbitrary user id): never callable by clients; invoked exclusively from
-- the SECURITY DEFINER functions below.
create function private.practice_lesson_reached(p_user uuid, p_activity uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  act public.practice_activities;
  v_course uuid;
  v_lesson_course uuid;
  v_current uuid;
begin
  if p_user is null then
    return false;
  end if;

  select * into act from public.practice_activities a where a.id = p_activity;
  if act.id is null then
    return false;
  end if;

  -- (a) Not linked to course content.
  if act.related_lesson_id is null and act.related_module_id is null then
    return true;
  end if;

  select m.course_id into v_lesson_course
  from public.lessons l join public.modules m on m.id = l.module_id
  where l.id = act.related_lesson_id;
  v_course := coalesce(
    v_lesson_course,
    (select m.course_id from public.modules m where m.id = act.related_module_id),
    act.course_id
  );

  -- (b) Teacher assignment to one of the Student's cohorts bypasses lesson gating (decision A).
  if v_course is not null and exists (
    select 1 from public.cohort_practice_assignments pa
    where pa.practice_activity_id = act.id
      and pa.cohort_id in (select private.student_course_cohorts(p_user, v_course))
  ) then
    return true;
  end if;

  if act.related_lesson_id is not null then
    -- (c) Lesson completed, started or accessed.
    if exists (
      select 1 from public.lesson_progress lp
      where lp.user_id = p_user and lp.lesson_id = act.related_lesson_id
    ) then
      return true;
    end if;
    -- (d) The Student's current lesson.
    v_current := private.student_current_lesson(p_user, v_course);
    return v_current is not null and v_current = act.related_lesson_id;
  end if;

  -- (e) Module-only link: any lesson of the module satisfies (c) or (d).
  -- A module without lessons has nothing to wait for and is never blocked.
  if not exists (select 1 from public.lessons l where l.module_id = act.related_module_id) then
    return true;
  end if;
  if exists (
    select 1 from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_user and l.module_id = act.related_module_id
  ) then
    return true;
  end if;
  v_current := private.student_current_lesson(p_user, v_course);
  return v_current is not null and exists (
    select 1 from public.lessons l where l.id = v_current and l.module_id = act.related_module_id
  );
end;
$$;
revoke all on function private.practice_lesson_reached(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. start_practice_attempt: resume / abandon-stale / gate unreached lessons
-- ---------------------------------------------------------------------------------------------------------
-- Body = 20261014120000 (auth, idempotency key, evaluation mode, enrollment scope, subscription gate) plus:
--   (i)   an existing idempotency key returns that attempt (error when it belongs to another activity);
--   (ii)  'Practice lesson not reached' (SQLSTATE YP001, hint PRACTICE_LESSON_NOT_REACHED) when the lesson is not reached;
--   (iii) an IN_PROGRESS FULL attempt with activity in the last 24 hours is resumed;
--   (iv)  otherwise open FULL attempts are ABANDONED and a new attempt is inserted.
-- Starts of the same (user, activity) are serialized by an advisory lock; the partial unique index is the backstop.
create or replace function public.start_practice_attempt(p_practice_activity_id uuid, p_idempotency_key uuid)
returns public.practice_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  activity_mode text;
  result_row public.practice_attempts;
  open_row public.practice_attempts;
  blocking_lesson uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'Practice idempotency key is required';
  end if;

  select activity.content ->> 'evaluationMode'
  into activity_mode
  from public.practice_activities activity
  where activity.id = p_practice_activity_id
    and activity.active
    and private.content_visible('practice_activities', activity.id);

  if activity_mode is null or activity_mode not in ('DETERMINISTIC', 'MANUAL_PENDING') then
    raise exception 'Practice activity is unsupported';
  end if;

  if not private.can_view_practice_activity(p_practice_activity_id) then
    raise exception 'Practice activity is unavailable' using errcode = '42501';
  end if;

  -- The paid-access trigger only fires on insert; resumed and replayed attempts must be gated the same way.
  if not private.has_paid_access(actor_user_id) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('practice-start:' || actor_user_id::text || ':' || p_practice_activity_id::text, 0)
  );

  -- (i) Idempotent replay.
  select * into result_row
  from public.practice_attempts a
  where a.user_id = actor_user_id and a.idempotency_key = p_idempotency_key;
  if result_row.id is not null then
    if result_row.practice_activity_id <> p_practice_activity_id then
      raise exception 'Idempotency key already belongs to another activity';
    end if;
    return result_row;
  end if;

  -- (ii) The lesson the practice belongs to must have been reached.
  if not private.practice_lesson_reached(actor_user_id, p_practice_activity_id) then
    select a.related_lesson_id into blocking_lesson
    from public.practice_activities a where a.id = p_practice_activity_id;
    raise exception 'Practice lesson not reached'
      using errcode = 'YP001',
            hint = 'PRACTICE_LESSON_NOT_REACHED',
            detail = coalesce(blocking_lesson::text, '');
  end if;

  -- (iii) Resume the recent open attempt.
  select * into open_row
  from public.practice_attempts a
  where a.user_id = actor_user_id
    and a.practice_activity_id = p_practice_activity_id
    and a.attempt_kind = 'FULL'
    and a.status = 'IN_PROGRESS'
  order by a.started_at desc, a.id desc
  limit 1
  for update;
  if open_row.id is not null and open_row.last_activity_at >= now() - interval '24 hours' then
    update public.practice_attempts
    set last_activity_at = now()
    where id = open_row.id
    returning * into result_row;
    return result_row;
  end if;

  -- (iv) Stale open attempts are abandoned; a fresh attempt starts.
  update public.practice_attempts
  set status = 'ABANDONED'
  where user_id = actor_user_id
    and practice_activity_id = p_practice_activity_id
    and attempt_kind = 'FULL'
    and status = 'IN_PROGRESS';

  begin
    insert into public.practice_attempts (
      user_id,
      practice_activity_id,
      idempotency_key,
      context,
      last_activity_at
    )
    values (
      actor_user_id,
      p_practice_activity_id,
      p_idempotency_key,
      jsonb_build_object('evaluation_mode', activity_mode),
      now()
    )
    returning * into result_row;
  exception
    when unique_violation then
      -- A concurrent start won (idempotency key or the one-open-attempt index): return its row.
      select * into result_row
      from public.practice_attempts a
      where a.user_id = actor_user_id and a.idempotency_key = p_idempotency_key;
      if result_row.id is null then
        select * into result_row
        from public.practice_attempts a
        where a.user_id = actor_user_id
          and a.practice_activity_id = p_practice_activity_id
          and a.attempt_kind = 'FULL'
          and a.status = 'IN_PROGRESS'
        order by a.started_at desc, a.id desc
        limit 1;
      end if;
      if result_row.id is null then
        raise;
      end if;
      if result_row.practice_activity_id <> p_practice_activity_id then
        raise exception 'Idempotency key already belongs to another activity';
      end if;
  end;

  return result_row;
end;
$$;
revoke all on function public.start_practice_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_practice_attempt(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Read RPC: reach state of every practice the caller may view
-- ---------------------------------------------------------------------------------------------------------
-- blocking_lesson_id: the lesson that must be reached first (null when reached). For a module-only link it is
-- the first lesson of the module in course order.
create function public.student_practice_reach()
returns table (practice_activity_id uuid, reached boolean, blocking_lesson_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select a.id,
         r.ok,
         case
           when r.ok then null::uuid
           else coalesce(
             a.related_lesson_id,
             (select l.id from public.lessons l
              where l.module_id = a.related_module_id
              order by l.position, l.id
              limit 1)
           )
         end
  from public.practice_activities a
  cross join lateral (select private.practice_lesson_reached(actor_user_id, a.id) as ok) r
  where private.can_view_practice_activity(a.id)
  order by a.id;
end;
$$;
revoke all on function public.student_practice_reach() from public, anon, authenticated;
grant execute on function public.student_practice_reach() to authenticated;
