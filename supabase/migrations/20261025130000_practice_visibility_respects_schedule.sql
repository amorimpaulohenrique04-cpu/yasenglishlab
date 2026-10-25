-- Merge fix: the lesson-bound visibility rule (ADR 0025) must still honour the scheduled release
-- of cohort practice assignments introduced by level-based cohorts (20261021141546).
-- Lesson access stays the access boundary; an assignment never grants access, but a practice
-- scheduled for the future in every one of the Student's course cohorts stays hidden until release.
create or replace function private.can_view_practice_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role('ADMIN',true) or exists(select 1 from public.practice_activities a
  where a.id=p_activity and (
    (private.has_role('TEACHER',true) and private.content_visible('practice_activities',a.id) and (a.created_by_teacher_id=(select t.id from public.teachers t where t.user_id=auth.uid() and t.active)
      or (a.created_by_teacher_id is null and private.content_visible('practice_activities',a.id))))
    or (private.has_role('STUDENT',false) and a.active and a.publication_status='PUBLISHED'
      and private.practice_lesson_available(a.id,auth.uid())
      and (a.audience<>'ASSIGNED'
        or not exists(select 1 from public.cohort_practice_assignments pa
          where pa.practice_activity_id=a.id
            and pa.cohort_id in (select private.student_course_cohorts(auth.uid(),(select i.course_id from private.path_content_info('practice_activities',a.id) i))))
        or exists(select 1 from public.cohort_practice_assignments pa
          where pa.practice_activity_id=a.id
            and pa.cohort_id in (select private.student_course_cohorts(auth.uid(),(select i.course_id from private.path_content_info('practice_activities',a.id) i)))
            and (pa.available_from is null or pa.available_from<=now()))))));
$$;
revoke all on function private.can_view_practice_activity(uuid) from public,anon;
grant execute on function private.can_view_practice_activity(uuid) to authenticated;

-- start_practice_attempt (redesign) checked lesson reach only; add the scheduled-release gate after it
-- so lesson-not-reached keeps its YP001 contract and an unreleased assignment fails closed (42501).
create or replace function public.start_practice_attempt(p_practice_activity_id uuid,p_idempotency_key uuid)
returns public.practice_attempts language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; activity public.practice_activities;
begin
 if not private.has_role('STUDENT',false) or p_idempotency_key is null then raise exception 'Student and idempotency key required' using errcode='42501'; end if;
 if not private.has_paid_access(auth.uid()) then raise exception 'active subscription required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-start:'||auth.uid()::text||':'||p_practice_activity_id::text,0));
 select * into a from public.practice_attempts where user_id=auth.uid() and idempotency_key=p_idempotency_key;
 if a.id is not null and a.practice_activity_id<>p_practice_activity_id then raise exception 'Idempotency key belongs to another activity' using errcode='23514'; end if;
 select * into a from public.practice_attempts where user_id=auth.uid() and practice_activity_id=p_practice_activity_id and status='SUBMITTED' order by submitted_at desc,id limit 1;
 if a.id is not null then return a; end if;
 select * into activity from public.practice_activities where id=p_practice_activity_id;
 if activity.id is null or not activity.active or activity.publication_status<>'PUBLISHED' then raise exception 'Practice activity is unavailable' using errcode='42501'; end if;
 if activity.related_lesson_id is not null and not private.student_path_includes('lessons',activity.related_lesson_id,auth.uid()) and not private.welcome_can_read('lessons',activity.related_lesson_id,auth.uid()) then raise exception 'Practice activity is unavailable' using errcode='42501'; end if;
 if not private.practice_lesson_available(activity.id,auth.uid()) then
  raise exception 'Practice lesson not reached' using errcode='YP001',hint='PRACTICE_LESSON_NOT_REACHED';
 end if;
 if not private.can_view_practice_activity(activity.id) then raise exception 'Practice activity is unavailable' using errcode='42501'; end if;
 select * into a from public.practice_attempts where user_id=auth.uid() and practice_activity_id=activity.id and status='IN_PROGRESS' and attempt_kind='FULL' for update;
 if a.id is not null then return a; end if;
 insert into public.practice_attempts(user_id,practice_activity_id,idempotency_key,context,last_activity_at)
  values(auth.uid(),activity.id,p_idempotency_key,jsonb_build_object('evaluation_mode',activity.content->>'evaluationMode'),now()) returning * into a;
 return a;
end $$;
revoke all on function public.start_practice_attempt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.start_practice_attempt(uuid,uuid) to authenticated;
