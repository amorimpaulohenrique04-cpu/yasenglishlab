create or replace function public.admin_student_curriculum_summary(p_student_user_id uuid)
returns table (
  enrollment_id uuid,
  course_id uuid,
  course_title text,
  lessons_completed bigint,
  lessons_total bigint,
  completion_percent integer,
  latest_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    c.id,
    c.title,
    count(distinct l.id) filter (where coalesce(lp.completion_percent, 0) = 100),
    count(distinct l.id),
    coalesce(round(avg(coalesce(lp.completion_percent, 0))), 0)::integer,
    max(lp.last_accessed_at)
  from public.enrollments as e
  join public.courses as c on c.id = e.course_id
  left join public.modules as m
    on m.course_id = c.id and m.publication_status = 'PUBLISHED'
  left join public.lessons as l
    on l.module_id = m.id and l.publication_status = 'PUBLISHED'
  left join public.lesson_progress as lp
    on lp.enrollment_id = e.id and lp.lesson_id = l.id
  where e.user_id = p_student_user_id
    and e.status = 'ACTIVE'
    and c.active
    and c.publication_status = 'PUBLISHED'
  group by e.id, c.id, c.title, e.enrolled_at
  order by e.enrolled_at desc, e.id
  limit 20;
end;
$$;

revoke all on function public.admin_student_curriculum_summary(uuid) from public, anon;
grant execute on function public.admin_student_curriculum_summary(uuid) to authenticated;
