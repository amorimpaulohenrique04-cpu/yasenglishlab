-- PR1 / Block 1D: one paginated, own-data-only list of everything a Student received feedback on.
-- Sources: practice (manual teacher reviews + submissions still waiting), placement test, and the
-- pedagogical placement review. It is a read model over the original rows, not a copy of the comments.
create function public.list_student_feedbacks(p_limit integer default 20, p_offset integer default 0)
returns table(
  source text,
  entity_id uuid,
  occurred_at timestamptz,
  title text,
  skill text,
  status text,
  notes text,
  details jsonb,
  total bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not private.has_role('STUDENT', false) then
    raise exception 'STUDENT required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset < 0 then
    raise exception 'invalid page' using errcode = '22023';
  end if;
  return query
  with feed as (
    select 'PRACTICE'::text as source, r.practice_attempt_id as entity_id, r.reviewed_at as occurred_at,
           a.title, a.skill, 'REVIEWED'::text as status, r.feedback as notes, r.ratings as details
    from public.practice_manual_reviews r
    join public.practice_attempts t on t.id = r.practice_attempt_id and t.user_id = v_user
    join public.practice_activities a on a.id = t.practice_activity_id
    union all
    select 'PRACTICE', t.id, coalesce(t.submitted_at, t.started_at), a.title, a.skill, 'PENDING', null, null
    from public.practice_attempts t
    join public.practice_activities a on a.id = t.practice_activity_id
    join public.practice_results pr on pr.practice_attempt_id = t.id and pr.evaluation_status = 'PENDING_MANUAL'
    where t.user_id = v_user
      and not exists (select 1 from public.practice_manual_reviews r where r.practice_attempt_id = t.id)
    union all
    select 'PLACEMENT_TEST', c.id, ta.submitted_at, 'Teste de nivelamento', null,
           case when exists (select 1 from public.placement_reviews pr where pr.placement_case_id = c.id)
                then 'REVIEWED' else 'PENDING' end, null, null
    from public.placement_cases c
    join public.assessment_attempts ta on ta.id = c.assessment_attempt_id
    where c.user_id = v_user and ta.submitted_at is not null
    union all
    select 'PEDAGOGICAL_REVIEW', c.id, pr.finalized_at, 'Avaliação pedagógica', null, 'REVIEWED', pr.feedback,
           jsonb_build_object('recommended_course_id', pr.recommended_course_id)
    from public.placement_reviews pr
    join public.placement_cases c on c.id = pr.placement_case_id
    where c.user_id = v_user
  )
  select f.source, f.entity_id, f.occurred_at, f.title, f.skill, f.status, f.notes, f.details,
         count(*) over () as total
  from feed f
  order by f.occurred_at desc, f.source, f.entity_id
  limit p_limit offset p_offset;
end $$;
revoke all on function public.list_student_feedbacks(integer, integer) from public, anon;
grant execute on function public.list_student_feedbacks(integer, integer) to authenticated;
