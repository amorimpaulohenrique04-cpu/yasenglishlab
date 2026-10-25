-- Practice review consistency: Student practice <-> Teacher review (plan R01-R05).
-- Additive read models only. finalize_practice_review, practice_submit_final, rubrics, objective scores and
-- notifications are untouched; nothing here writes data. get_teacher_reviews(p_attempt) stays the detail read.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Student Feedbacks (R01): one PRACTICE row per attempt, never one per comment.
--    PENDING = PENDING_MANUAL with zero reviewed items; PARTIAL = PENDING_MANUAL with at least one;
--    REVIEWED = MANUAL_REVIEWED. Counters come from the round-1 PENDING_MANUAL responses (v3) and their reviews,
--    not from practice_results.metrics (written once at submission). v1/v2 count as one manual answer.
--    notes/details stay the legacy whole-attempt review; v3 comments are read per item on /pratica/<attempt>.
--    The return type gains columns, so the function is recreated with the same name, arguments and grants.
-- ---------------------------------------------------------------------------------------------------------
drop function public.list_student_feedbacks(integer, integer);
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
  manual_total integer,
  manual_reviewed integer,
  manual_pending integer,
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
  with practice as (
    select t.id, a.title, a.skill, pr.evaluation_status as result_status,
           coalesce(rv.last_at, t.submitted_at, t.started_at) as occurred_at,
           case when v3.n > 0 then v3.n else 1 end as manual_total,
           case when v3.n > 0 then v3.reviewed else least(rv.n, 1) end as manual_reviewed,
           legacy.feedback, legacy.ratings
    from public.practice_attempts t
    join public.practice_activities a on a.id = t.practice_activity_id
    left join public.practice_results pr on pr.practice_attempt_id = t.id
    cross join lateral (
      select count(*)::integer as n, max(r.reviewed_at) as last_at
      from public.practice_manual_reviews r where r.practice_attempt_id = t.id) rv
    cross join lateral (
      select count(*)::integer as n, count(r.id)::integer as reviewed
      from public.practice_item_responses ir
      left join public.practice_manual_reviews r
        on r.practice_attempt_id = ir.practice_attempt_id and r.item_id = ir.item_id
      where ir.practice_attempt_id = t.id and ir.round = 1 and ir.evaluation_status = 'PENDING_MANUAL') v3
    left join public.practice_manual_reviews legacy on legacy.practice_attempt_id = t.id and legacy.item_id is null
    where t.user_id = v_user and (pr.evaluation_status = 'PENDING_MANUAL' or rv.n > 0)
  ),
  feed as (
    select 'PRACTICE'::text as source, p.id as entity_id, p.occurred_at, p.title, p.skill,
           case when p.result_status = 'MANUAL_REVIEWED' then 'REVIEWED'
                when p.result_status = 'PENDING_MANUAL' and p.manual_reviewed = 0 then 'PENDING'
                when p.result_status = 'PENDING_MANUAL' then 'PARTIAL'
                when p.manual_reviewed >= p.manual_total then 'REVIEWED'
                else 'PARTIAL' end as status,
           p.feedback as notes, p.ratings as details,
           p.manual_total, p.manual_reviewed, p.manual_total - p.manual_reviewed as manual_pending
    from practice p
    union all
    select 'PLACEMENT_TEST', c.id, ta.submitted_at, 'Teste de nivelamento', null,
           case when exists (select 1 from public.placement_reviews pr where pr.placement_case_id = c.id)
                then 'REVIEWED' else 'PENDING' end, null, null, null, null, null
    from public.placement_cases c
    join public.assessment_attempts ta on ta.id = c.assessment_attempt_id
    where c.user_id = v_user and ta.submitted_at is not null
    union all
    select 'PEDAGOGICAL_REVIEW', c.id, pr.finalized_at, 'Avaliação pedagógica', null, 'REVIEWED', pr.feedback,
           jsonb_build_object('recommended_course_id', pr.recommended_course_id), null, null, null
    from public.placement_reviews pr
    join public.placement_cases c on c.id = pr.placement_case_id
    where c.user_id = v_user
  )
  select f.source, f.entity_id, f.occurred_at, f.title, f.skill, f.status, f.notes, f.details,
         f.manual_total, f.manual_reviewed, f.manual_pending,
         count(*) over () as total
  from feed f
  order by f.occurred_at desc, f.source, f.entity_id
  limit p_limit offset p_offset;
end $$;
revoke all on function public.list_student_feedbacks(integer, integer) from public, anon;
grant execute on function public.list_student_feedbacks(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Pending manual answers in the signed-in Teacher's scope: the eligibility of get_teacher_reviews() without
--    its row limits. One row per pending answer: legacy/v2 attempts (item_id null) and v3 WRITTEN/SPOKEN items
--    without a review. kind mirrors reviewKind() in the UI: WRITTEN -> writing, PRONUNCIATION -> pronunciation.
-- ---------------------------------------------------------------------------------------------------------
create function private.teacher_review_pending_items()
returns table(attempt_id uuid, item_id text, item_position integer, student_id uuid, student_name text, title text,
  skill text, prompt text, response_type text, response jsonb, submitted_at timestamptz, kind text)
language sql stable security definer set search_path = '' as $$
  select x.*, case when x.response_type = 'WRITTEN' then 'writing'
                   when x.skill = 'PRONUNCIATION' then 'pronunciation' else 'speaking' end
  from (
    select a.id as attempt_id, null::text as item_id, 1 as item_position, a.user_id as student_id,
           p.display_name as student_name, activity.title, activity.skill,
           coalesce(activity.content ->> 'prompt', '') as prompt,
           coalesce(activity.content #>> '{response,type}', activity.content ->> 'kind') as response_type,
           response.response, coalesce(a.submitted_at, a.started_at) as submitted_at
    from public.practice_attempts a
    join public.practice_activities activity on activity.id = a.practice_activity_id
    join public.profiles p on p.user_id = a.user_id
    join public.practice_responses response on response.practice_attempt_id = a.id
    join public.practice_results result on result.practice_attempt_id = a.id
    where private.is_teacher_assigned(a.user_id) and result.evaluation_status = 'PENDING_MANUAL'
      and (activity.skill in ('SPEAKING', 'PRONUNCIATION')
           or (activity.content -> 'version' = '2'::jsonb and activity.content #>> '{response,type}' in ('WRITTEN', 'SPOKEN')))
    union all
    select a.id, ir.item_id, it.item_position, a.user_id, p.display_name, activity.title, activity.skill,
           coalesce(it.prompt, ''), it.response ->> 'type', ir.response, coalesce(a.submitted_at, a.started_at)
    from public.practice_attempts a
    join public.practice_activities activity on activity.id = a.practice_activity_id and activity.content -> 'version' = '3'::jsonb
    join public.profiles p on p.user_id = a.user_id
    join public.practice_item_responses ir on ir.practice_attempt_id = a.id and ir.round = 1 and ir.evaluation_status = 'PENDING_MANUAL'
    cross join lateral (select x.prompt, x.response, x.item_position from private.practice_items(a.practice_activity_id) x
                        where x.item_id = ir.item_id) it
    where a.status = 'SUBMITTED' and private.is_teacher_assigned(a.user_id)
      and not exists (select 1 from public.practice_manual_reviews mr where mr.practice_attempt_id = a.id and mr.item_id = ir.item_id)
  ) x;
$$;
revoke all on function private.teacher_review_pending_items() from public, anon, authenticated;

-- Search text as the UI normalizes it: lower case, Portuguese diacritics removed.
create function private.review_search_norm(p_text text)
returns text language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(p_text, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;
revoke all on function private.review_search_norm(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Review queue page (R04/R05): attempts are filtered, ordered and paginated first; then ALL pending answers of
--    the page's attempts are attached, so an attempt is never split across pages. kinds = union of its pending
--    answers, so a written + spoken attempt is in both tabs and once in "all" (tab counts may sum above total).
--    Totals, tab counts, oldest submission and cohorts cover the Teacher's whole scope, not the page.
--    p_filters: {tab, q, cohort, order: oldest|newest, limit: 1..50, after: {submittedAt, id}}.
-- ---------------------------------------------------------------------------------------------------------
create function public.get_teacher_review_queue_page(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tab text; v_q text; v_cohort text; v_newest boolean; v_limit integer;
  v_after_at timestamptz; v_after_id uuid;
  v_now timestamptz := now();
  result jsonb;
begin
  perform private.current_teacher_id();
  begin
    v_tab := coalesce(p_filters ->> 'tab', 'all');
    v_q := private.review_search_norm(left(btrim(coalesce(p_filters ->> 'q', '')), 200));
    v_cohort := left(coalesce(p_filters ->> 'cohort', ''), 200);
    v_newest := coalesce(p_filters ->> 'order', 'oldest') = 'newest';
    v_limit := coalesce((p_filters ->> 'limit')::integer, 20);
    if p_filters ? 'after' and jsonb_typeof(p_filters -> 'after') <> 'null' then
      v_after_at := (p_filters #>> '{after,submittedAt}')::timestamptz;
      v_after_id := (p_filters #>> '{after,id}')::uuid;
    end if;
  exception when others then
    raise exception 'invalid queue filters' using errcode = '22023';
  end;
  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object'
     or v_tab not in ('all', 'speaking', 'pronunciation', 'writing', 'over24h')
     or coalesce(p_filters ->> 'order', 'oldest') not in ('oldest', 'newest')
     or v_limit not between 1 and 50
     or (p_filters ? 'after' and jsonb_typeof(p_filters -> 'after') <> 'null' and (v_after_at is null or v_after_id is null)) then
    raise exception 'invalid queue filters' using errcode = '22023';
  end if;

  with items as (
    select * from private.teacher_review_pending_items()
  ),
  attempts as (
    select i.attempt_id as id, i.student_id, max(i.student_name) as student_name, max(i.title) as title,
           max(i.skill) as skill, max(i.submitted_at) as submitted_at,
           array_agg(distinct i.kind order by i.kind) as kinds, count(*)::integer as pending_items
    from items i group by i.attempt_id, i.student_id
  ),
  student_cohorts as (
    select m.user_id, array_agg(distinct c.name order by c.name) as names
    from public.cohort_memberships m join public.cohorts c on c.id = m.cohort_id
    where m.status = 'ACTIVE' and m.starts_at <= v_now and (m.ends_at is null or m.ends_at > v_now)
      and private.is_cohort_teacher(c.id)
    group by m.user_id
  ),
  scoped as (
    select a.*, coalesce(sc.names, array[]::text[]) as cohort_names
    from attempts a left join student_cohorts sc on sc.user_id = a.student_id
  ),
  filtered as (
    select s.* from scoped s
    where (v_tab = 'all' or (v_tab = 'over24h' and s.submitted_at <= v_now - interval '24 hours') or v_tab = any (s.kinds))
      and (v_cohort = '' or v_cohort = any (s.cohort_names))
      and (v_q = '' or strpos(private.review_search_norm(coalesce(s.student_name, 'Aluno') || ' ' || s.title), v_q) > 0)
  ),
  after_cursor as (
    select f.* from filtered f
    where v_after_at is null
       or (not v_newest and (f.submitted_at, f.id) > (v_after_at, v_after_id))
       or (v_newest and (f.submitted_at, f.id) < (v_after_at, v_after_id))
  ),
  page as (
    select o.*, row_number() over (
             order by case when v_newest then o.submitted_at end desc, case when v_newest then o.id end desc,
                      o.submitted_at, o.id) as ord
    from after_cursor o
  ),
  visible as (
    select * from page where ord <= v_limit
  )
  select jsonb_build_object(
    'total', (select count(*) from scoped),
    'filteredTotal', (select count(*) from filtered),
    'counts', (select jsonb_build_object(
        'all', count(*),
        'speaking', count(*) filter (where 'speaking' = any (s.kinds)),
        'pronunciation', count(*) filter (where 'pronunciation' = any (s.kinds)),
        'writing', count(*) filter (where 'writing' = any (s.kinds)),
        'over24h', count(*) filter (where s.submitted_at <= v_now - interval '24 hours'))
      from scoped s),
    'oldestSubmittedAt', (select min(s.submitted_at) from scoped s),
    'cohorts', coalesce((select jsonb_agg(distinct n order by n) from scoped s cross join unnest(s.cohort_names) n), '[]'::jsonb),
    'hasMore', exists (select 1 from page where ord = v_limit + 1),
    'nextCursor', case when exists (select 1 from page where ord = v_limit + 1) then
        (select jsonb_build_object('submittedAt', v.submitted_at, 'id', v.id) from visible v where v.ord = v_limit) end,
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'studentId', v.student_id, 'studentName', v.student_name, 'title', v.title, 'skill', v.skill,
        'submittedAt', v.submitted_at, 'kinds', to_jsonb(v.kinds), 'pendingItems', v.pending_items,
        'cohortNames', to_jsonb(v.cohort_names),
        'items', (select jsonb_agg(jsonb_build_object(
            'id', i.attempt_id, 'itemId', i.item_id, 'studentId', i.student_id, 'studentName', i.student_name,
            'title', i.title, 'skill', i.skill, 'prompt', i.prompt, 'responseType', i.response_type,
            'response', i.response, 'submittedAt', i.submitted_at, 'status', 'PENDING_MANUAL')
            order by i.item_position, i.item_id)
          from items i where i.attempt_id = v.id))
        order by v.ord) from visible v), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_teacher_review_queue_page(jsonb) from public, anon, authenticated;
grant execute on function public.get_teacher_review_queue_page(jsonb) to authenticated;

-- "n de m" and ‹ › of one attempt in the oldest-first queue. Outside the queue (already reviewed), next is the
-- first pending attempt submitted after it, else the oldest one.
create function public.get_teacher_review_queue_position(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.current_teacher_id();
  with attempts as (
    select i.attempt_id as id, max(i.submitted_at) as submitted_at
    from private.teacher_review_pending_items() i group by i.attempt_id
  ),
  ordered as (
    select a.id, a.submitted_at, row_number() over w as pos, lag(a.id) over w as prev, lead(a.id) over w as next
    from attempts a window w as (order by a.submitted_at, a.id)
  ),
  current_attempt as (
    select coalesce(t.submitted_at, t.started_at) as submitted_at from public.practice_attempts t
    where t.id = p_attempt and private.is_teacher_assigned(t.user_id)
  )
  select coalesce(
    (select jsonb_build_object('position', o.pos, 'total', (select count(*) from ordered), 'prev', o.prev, 'next', o.next)
     from ordered o where o.id = p_attempt),
    jsonb_build_object('position', null, 'total', (select count(*) from ordered), 'prev', null,
      'next', coalesce(
        (select o.id from ordered o, current_attempt c
         where (o.submitted_at, o.id) > (c.submitted_at, p_attempt) order by o.pos limit 1),
        (select o.id from ordered o order by o.pos limit 1))))
  into result;
  return result;
end $$;
revoke all on function public.get_teacher_review_queue_position(uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_review_queue_position(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Review context (R03): the same scope check, plus every question of the attempt in its original order.
--    Read-only: prompt, public response definition (options/items labels from content, never
--    private.practice_item_keys), the Student's round-1 answer, its persisted evaluation and whether a manual review
--    exists. v1/v2 project one question. Audio stays behind authorize_practice_media / the Teacher playback action.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.get_teacher_review_context(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_attempt public.practice_attempts;
  v_activity public.practice_activities;
begin
  perform private.current_teacher_id();
  select * into v_attempt from public.practice_attempts a where a.id = p_attempt;
  if v_attempt.id is null or not private.is_teacher_assigned(v_attempt.user_id) then
    return null;
  end if;
  select * into v_activity from public.practice_activities where id = v_attempt.practice_activity_id;
  return jsonb_build_object(
    'cohortNames', coalesce((select jsonb_agg(distinct c.name)
      from public.cohort_memberships m join public.cohorts c on c.id = m.cohort_id
      where m.user_id = v_attempt.user_id and m.status = 'ACTIVE' and m.starts_at <= now()
        and (m.ends_at is null or m.ends_at > now()) and private.is_cohort_teacher(c.id)), '[]'::jsonb),
    'mediaDurationSeconds', (select max(media.duration_seconds) from public.practice_response_media media
      where media.practice_attempt_id = p_attempt),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'itemId', r.item_id, 'ratings', r.ratings, 'feedback', r.feedback, 'reviewedAt', r.reviewed_at)
        order by r.reviewed_at, r.id)
      from public.practice_manual_reviews r where r.practice_attempt_id = p_attempt), '[]'::jsonb),
    'questions', case when v_activity.content -> 'version' = '3'::jsonb then
      coalesce((select jsonb_agg(jsonb_build_object(
          'itemId', it.item_id, 'position', it.item_position, 'prompt', coalesce(it.prompt, ''),
          'responseType', it.response ->> 'type', 'definition', it.response,
          'response', ir.response, 'evaluationStatus', ir.evaluation_status,
          'manual', it.response ->> 'type' in ('WRITTEN', 'SPOKEN'),
          'reviewed', exists (select 1 from public.practice_manual_reviews r
                              where r.practice_attempt_id = p_attempt and r.item_id = it.item_id),
          'mediaDurationSeconds', (select max(media.duration_seconds) from public.practice_response_media media
                                   where media.practice_attempt_id = p_attempt and media.item_id = it.item_id))
          order by it.item_position)
        from private.practice_items(v_activity.id) it
        left join public.practice_item_responses ir
          on ir.practice_attempt_id = p_attempt and ir.item_id = it.item_id and ir.round = 1
        where v_attempt.item_ids is null or it.item_id = any (v_attempt.item_ids)), '[]'::jsonb)
    else jsonb_build_array(jsonb_build_object(
      'itemId', null, 'position', 1, 'prompt', coalesce(v_activity.content ->> 'prompt', ''),
      'responseType', coalesce(v_activity.content #>> '{response,type}', v_activity.content ->> 'kind'),
      'definition', null,
      'response', (select response.response from public.practice_responses response
                   where response.practice_attempt_id = p_attempt),
      'evaluationStatus', (select result.evaluation_status from public.practice_results result
                           where result.practice_attempt_id = p_attempt),
      'manual', true,
      'reviewed', exists (select 1 from public.practice_manual_reviews r
                          where r.practice_attempt_id = p_attempt and r.item_id is null),
      'mediaDurationSeconds', (select max(media.duration_seconds) from public.practice_response_media media
                               where media.practice_attempt_id = p_attempt)))
    end
  );
end $$;
revoke all on function public.get_teacher_review_context(uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_review_context(uuid) to authenticated;
