-- PR1 / Block 1B: a cohort window fits a student's availability when both describe the same
-- instants, not when their IANA timezone strings are equal. The next occurrence of each cohort
-- window is projected into the student's timezone, so DST and different zones are handled.
create or replace function private.placement_cohort_compatible(p_case_id uuid, p_cohort_id uuid, p_require_track boolean default true)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.cohorts co
 join public.courses course on course.id = co.course_id
 join public.cohort_placement_settings settings on settings.cohort_id = co.id
 join public.placement_reviews r on r.placement_case_id = p_case_id
 where co.id = p_cohort_id and co.status = 'ACTIVE' and (co.ends_at is null or co.ends_at > now())
 and course.active and course.publication_status = 'PUBLISHED'
 and (not p_require_track or co.course_id = r.recommended_course_id)
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
