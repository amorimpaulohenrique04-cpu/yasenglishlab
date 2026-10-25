-- Next free interval: merge back-to-back/overlapping active availability before subtracting
-- scheduled sessions, and start an in-progress interval at now() rounded UP to the next 5 minutes.
-- Same signature, security definer, empty search_path and AAL2 teacher gate as before.
create or replace function public.teacher_availability_workspace(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb;
 rounded_now timestamptz:=to_timestamp(ceil(extract(epoch from now())/300)*300);
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '8 days' then raise exception 'Invalid week' using errcode='22023'; end if;
 select jsonb_build_object(
  'slots',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at,'active',a.active,'series_id',a.series_id,
   'series_until',r.ends_on,'future_count',case when a.series_id is null then 1 else (select count(*) from public.teacher_availability f where f.series_id=a.series_id and f.starts_at>=a.starts_at and f.starts_at>now()) end,
   'future_until',case when a.series_id is null then a.ends_at else (select max(f.ends_at) from public.teacher_availability f where f.series_id=a.series_id and f.starts_at>=a.starts_at and f.starts_at>now()) end) order by a.starts_at,a.id)
   from public.teacher_availability a left join public.teacher_availability_series r on r.id=a.series_id
   where a.teacher_id=teacher and a.ends_at>p_from and a.starts_at<p_to),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at)
   from public.live_sessions s where s.teacher_id=teacher and s.status='SCHEDULED' and s.ends_at>p_from and s.starts_at<p_to),'[]'::jsonb),
  'next_free',(select jsonb_build_object('starts_at',lower(free),'ends_at',upper(free))
   from unnest(
    coalesce((select range_agg(tstzrange(greatest(a.starts_at,rounded_now),a.ends_at,'[)')) from public.teacher_availability a
      where a.teacher_id=teacher and a.active and a.ends_at>rounded_now),'{}'::tstzmultirange)
    - coalesce((select range_agg(tstzrange(s.starts_at,s.ends_at,'[)')) from public.live_sessions s
      where s.teacher_id=teacher and s.status='SCHEDULED' and s.ends_at>now()),'{}'::tstzmultirange)) free
   where not isempty(free) order by lower(free) limit 1)
 ) into result;
 return result;
end $$;
revoke all on function public.teacher_availability_workspace(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.teacher_availability_workspace(timestamptz,timestamptz) to authenticated;
