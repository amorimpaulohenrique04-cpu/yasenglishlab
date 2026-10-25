-- Additive teacher workspace projection. No meeting references or pedagogical data.
-- A JSON envelope avoids the Data API row cap; each count covers the complete interval.
create function public.get_teacher_session_workspace(
  p_from timestamptz default null, p_to timestamptz default null,
  p_session_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); result jsonb;
begin
  if p_from is not null and p_to is not null and p_to <= p_from then
    raise exception 'Invalid interval' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(r) order by r.starts_at, r.id) from (
      select s.id, s.title, s.session_type, s.starts_at, s.ends_at, s.status, s.capacity,
        s.cohort_id, c.name as cohort_name, s.target_student_user_id,
        exists(select 1 from public.session_bookings b where b.live_session_id=s.id) as has_bookings,
        (select count(*) from public.session_bookings b where b.live_session_id=s.id and b.status='BOOKED') as participant_count,
        (select count(*) from public.session_bookings b join public.attendance a on a.session_booking_id=b.id
          where b.live_session_id=s.id and b.status='BOOKED' and a.status='ATTENDED') as attended_count,
        (select count(*) from public.session_bookings b join public.attendance a on a.session_booking_id=b.id
          where b.live_session_id=s.id and b.status='BOOKED' and a.status='NO_SHOW') as no_show_count,
        coalesce((select jsonb_agg(b.user_id order by b.user_id) from public.session_bookings b
          where b.live_session_id=s.id and b.status='BOOKED'),'[]'::jsonb) as student_ids,
        coalesce((select string_agg(coalesce(p.display_name,'Participante'),' ' order by b.id)
          from public.session_bookings b left join public.profiles p on p.user_id=b.user_id
          where b.live_session_id=s.id),'') as participant_search
      from public.live_sessions s left join public.cohorts c on c.id=s.cohort_id
      where s.teacher_id=teacher and (p_session_id is null or s.id=p_session_id)
        and (p_from is null or s.ends_at > p_from) and (p_to is null or s.starts_at < p_to)
    ) r),'[]'::jsonb),
    'availability', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at) order by a.starts_at,a.id)
      from public.teacher_availability a where a.teacher_id=teacher
        and (p_from is null or a.ends_at>p_from) and (p_to is null or a.starts_at<p_to)),'[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
      from public.cohorts c where c.status='ACTIVE' and private.is_cohort_teacher(c.id)),'[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',coalesce(p.display_name,'Aluno')) order by p.display_name,p.user_id)
      from public.profiles p where private.is_teacher_assigned(p.user_id)
        and exists(select 1 from public.user_roles ur where ur.user_id=p.user_id and ur.role='STUDENT')),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_teacher_session_workspace(timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.get_teacher_session_workspace(timestamptz,timestamptz,uuid) to authenticated;
