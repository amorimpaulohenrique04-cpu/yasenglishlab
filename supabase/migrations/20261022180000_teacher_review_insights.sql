-- Additive, read-only projections for the Teacher review workspace.
-- No grading rule changes: reviews stay categorical (ADR 0010) and nothing here writes data.

-- Workload facts for the signed-in Teacher plus the cohorts of the students they can review.
create function public.get_teacher_review_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  teacher uuid := private.current_teacher_id();
  today date := (now() at time zone 'America/Recife')::date;
  result jsonb;
begin
  select jsonb_build_object(
    'reviewedToday', (select count(*) from public.practice_manual_reviews r
      where r.teacher_id = teacher and (r.reviewed_at at time zone 'America/Recife')::date = today),
    'reviewedYesterday', (select count(*) from public.practice_manual_reviews r
      where r.teacher_id = teacher and (r.reviewed_at at time zone 'America/Recife')::date = today - 1),
    -- Minutes between the Student submission and the Teacher review, last 7 days vs the 7 before.
    'avgResponseMinutes7d', (select round(avg(extract(epoch from r.reviewed_at - a.submitted_at) / 60))
      from public.practice_manual_reviews r join public.practice_attempts a on a.id = r.practice_attempt_id
      where r.teacher_id = teacher and r.reviewed_at >= now() - interval '7 days'),
    'avgResponseMinutesPrev7d', (select round(avg(extract(epoch from r.reviewed_at - a.submitted_at) / 60))
      from public.practice_manual_reviews r join public.practice_attempts a on a.id = r.practice_attempt_id
      where r.teacher_id = teacher and r.reviewed_at >= now() - interval '14 days'
        and r.reviewed_at < now() - interval '7 days'),
    'studentCohorts', coalesce((select jsonb_object_agg(x.user_id::text, x.names) from (
      select m.user_id, jsonb_agg(distinct c.name) as names
      from public.cohort_memberships m join public.cohorts c on c.id = m.cohort_id
      where m.status = 'ACTIVE' and m.starts_at <= now() and (m.ends_at is null or m.ends_at > now())
        and private.is_cohort_teacher(c.id)
      group by m.user_id) x), '{}'::jsonb)
  ) into result;
  return result;
end $$;

-- Context of one attempt the Teacher may review: cohorts, audio length and the reviews already sent.
-- Returns null outside the Teacher scope, like get_teacher_reviews returns no rows.
create function public.get_teacher_review_context(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare student uuid;
begin
  perform private.current_teacher_id();
  select a.user_id into student from public.practice_attempts a where a.id = p_attempt;
  if student is null or not private.is_teacher_assigned(student) then
    return null;
  end if;
  return jsonb_build_object(
    'cohortNames', coalesce((select jsonb_agg(distinct c.name)
      from public.cohort_memberships m join public.cohorts c on c.id = m.cohort_id
      where m.user_id = student and m.status = 'ACTIVE' and m.starts_at <= now()
        and (m.ends_at is null or m.ends_at > now()) and private.is_cohort_teacher(c.id)), '[]'::jsonb),
    'mediaDurationSeconds', (select max(media.duration_seconds) from public.practice_response_media media
      where media.practice_attempt_id = p_attempt),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'itemId', r.item_id, 'ratings', r.ratings, 'feedback', r.feedback, 'reviewedAt', r.reviewed_at)
        order by r.reviewed_at, r.id)
      from public.practice_manual_reviews r where r.practice_attempt_id = p_attempt), '[]'::jsonb)
  );
end $$;

revoke all on function public.get_teacher_review_overview() from public, anon, authenticated;
grant execute on function public.get_teacher_review_overview() to authenticated;
revoke all on function public.get_teacher_review_context(uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_review_context(uuid) to authenticated;
