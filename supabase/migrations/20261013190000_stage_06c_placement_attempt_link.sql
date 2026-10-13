-- Stage 06c: the Placement only reuses an assessment attempt that is linked to its own case.
-- start_assessment_attempt(version, case id) stores the case id as assessment_attempts.idempotency_key
-- (uuid), so that key is the link. Attempts of other origin or of unpublished versions are never evidence.
create or replace function public.start_placement_assessment() returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; v uuid; a public.assessment_attempts;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 if c.assessment_attempt_id is not null then return c.assessment_attempt_id; end if;
 if c.state<>'ASSESSMENT_REQUIRED' then raise exception 'onboarding preferences required' using errcode='23514'; end if;
 select av.id into v from public.assessment_versions av join public.assessments assessment on assessment.id=av.assessment_id where av.status='PUBLISHED' and assessment.active and exists(select 1 from public.assessment_items i where i.assessment_version_id=av.id) order by av.published_at desc,av.id limit 1;
 if v is null then raise exception 'published assessment unavailable' using errcode='23514'; end if;
 select * into a from public.assessment_attempts where user_id=c.user_id and idempotency_key=c.id and status in ('IN_PROGRESS','SUBMITTED','SCORED') order by started_at desc,id limit 1;
 if a.id is null then a:=public.start_assessment_attempt(v,c.id); end if;
 update public.placement_cases set assessment_attempt_id=a.id,state='IN_PROGRESS' where id=c.id;
 if a.status in ('SUBMITTED','SCORED') then update public.placement_cases set state='REVIEW_PENDING' where id=c.id; end if;
 return a.id;
end $$;
revoke all on function public.start_placement_assessment() from public,anon,authenticated;
grant execute on function public.start_placement_assessment() to authenticated;
