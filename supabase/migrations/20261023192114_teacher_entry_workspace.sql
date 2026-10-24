-- Personal working copies. Final recommendations remain in placement_reviews.
create table public.placement_review_drafts (
  placement_case_id uuid not null references public.placement_cases(id),
  teacher_id uuid not null references auth.users(id),
  course_id uuid references public.courses(id),
  confidence text check (confidence in ('LOW','MEDIUM','HIGH')),
  feedback text not null default '' check (length(feedback)<=4000),
  notes text not null default '' check (length(notes)<=4000),
  revision integer not null default 1 check (revision>0),
  updated_at timestamptz not null default now(),
  saved_at timestamptz[] not null default array[now()],
  primary key(placement_case_id,teacher_id)
);
alter table public.placement_review_drafts enable row level security;
revoke all on public.placement_review_drafts from public,anon,authenticated;
grant select on public.placement_review_drafts to authenticated;
create policy personal_draft_read on public.placement_review_drafts for select to authenticated
using (teacher_id=(select auth.uid()) and private.has_role('TEACHER',true)
  and exists(select 1 from public.placement_cases c where c.id=placement_case_id and private.is_teacher_assigned(c.user_id)));

create function public.save_teacher_entry_draft(p_case_id uuid,p_course_id uuid,p_confidence text,
 p_feedback text,p_notes text,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; d public.placement_review_drafts;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 select * into c from public.placement_cases where id=p_case_id for update;
 if c.id is null or not private.is_teacher_assigned(c.user_id) then raise exception 'Teacher scope required' using errcode='42501'; end if;
 if c.state<>'REVIEW_PENDING' then raise exception 'Review already finalized' using errcode='23514'; end if;
 select * into d from public.placement_review_drafts where placement_case_id=c.id and teacher_id=auth.uid();
 if p_revision is null or p_revision<>coalesce(d.revision,0) then raise exception 'Draft revision conflict' using errcode='40001'; end if;
 if p_course_id is not null and not exists(select 1 from public.courses where id=p_course_id and active and publication_status='PUBLISHED') then raise exception 'Published course required' using errcode='23514'; end if;
 if d.revision is null then
  insert into public.placement_review_drafts(placement_case_id,teacher_id,course_id,confidence,feedback,notes)
  values(c.id,auth.uid(),p_course_id,p_confidence,p_feedback,p_notes) returning * into d;
 else
  update public.placement_review_drafts set course_id=p_course_id,confidence=p_confidence,
   feedback=p_feedback,notes=p_notes,revision=revision+1,updated_at=now(),saved_at=array_append(saved_at,now())
  where placement_case_id=c.id and teacher_id=auth.uid() returning * into d;
 end if;
 return jsonb_build_object('courseId',d.course_id,'confidence',d.confidence,'feedback',d.feedback,
  'notes',d.notes,'revision',d.revision,'updatedAt',d.updated_at);
end $$;

-- Atomic finalization with the personal notes; reuse the canonical immutable command.
create function public.finalize_teacher_entry(p_case_id uuid,p_course_id uuid,p_confidence text,
 p_feedback text,p_notes text,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 -- The canonical function verifies assignment and conflicting retries as well.
 if not exists(select 1 from public.placement_reviews where placement_case_id=p_case_id) then
  perform public.save_teacher_entry_draft(p_case_id,p_course_id,p_confidence,p_feedback,p_notes,p_revision);
 end if;
 v_id:=public.finalize_placement_review(p_case_id,p_course_id,p_feedback,p_confidence);
 return v_id;
end $$;

create function public.teacher_entry_queue(p_q text default '',p_status text default 'active',
 p_cohort text default '',p_order text default 'oldest',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 if p_status not in ('active','all','pending','draft','done','overdue') or p_order not in ('oldest','newest') or p_page<1 or p_page>100000 or length(p_q)>120 or length(p_cohort)>160 then raise exception 'Invalid filters' using errcode='22023'; end if;
 with scoped as materialized (
  select c.id,coalesce(p.display_name,'Aluno') as name,
   (select co.name from public.cohort_memberships m join public.cohorts co on co.id=m.cohort_id where m.id=c.membership_id) as cohort,
   a.submitted_at,c.state_changed_at as entered_at,r.finalized_at,
   case when r.id is not null then 'done' when d.revision is not null then 'draft' else 'pending' end as status,
   coalesce((select jsonb_agg(distinct i.skill) from public.assessment_items i where i.assessment_version_id=a.assessment_version_id),'[]'::jsonb) as skills
  from public.placement_cases c
  join public.assessment_attempts a on a.id=c.assessment_attempt_id
  left join public.profiles p on p.user_id=c.user_id
  left join public.placement_reviews r on r.placement_case_id=c.id
  left join public.placement_review_drafts d on d.placement_case_id=c.id and d.teacher_id=auth.uid()
  where private.is_teacher_assigned(c.user_id) and (c.state='REVIEW_PENDING' or r.id is not null)
 ), filtered as materialized (
  select * from scoped s where
   (p_q='' or strpos(lower(s.name||' '||s.skills::text),lower(p_q))>0)
   and (p_cohort='' or s.cohort=p_cohort)
   and (p_status='all' or (p_status='active' and status<>'done') or status=p_status
    or (p_status='overdue' and status<>'done' and entered_at<=now()-interval '24 hours'))
 ), paged as (
  select * from filtered order by
   case when p_order='oldest' then submitted_at end asc nulls last,
   case when p_order='newest' then submitted_at end desc nulls last,id
  limit 20 offset (p_page-1)*20
 ) select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'cohort',cohort,'submittedAt',submitted_at,
    'enteredReviewAt',entered_at,'status',status,'skills',skills)) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',p_page,'pageSize',20,
  'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),
   'draft',count(*) filter(where status='draft'),'overdue',count(*) filter(where status<>'done' and entered_at<=now()-interval '24 hours'),
   'today',count(*) filter(where (finalized_at at time zone 'America/Recife')::date=(now() at time zone 'America/Recife')::date)) from scoped),
  'cohorts',coalesce((select jsonb_agg(cohort order by cohort) from (select distinct cohort from scoped where cohort is not null) co),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.get_placement_review_evidence(p_case_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.placement_cases;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or not private.is_teacher_assigned(c.user_id) then raise exception 'Teacher scope required' using errcode='42501'; end if;
 return jsonb_build_object('attemptId',c.assessment_attempt_id,
  'scores',coalesce((select jsonb_agg(jsonb_build_object('skill',skill,'score',score,'maxScore',max_score,'provenance',provenance)) from public.skill_scores where assessment_attempt_id=c.assessment_attempt_id),'[]'::jsonb),
  'responses',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'itemType',i.item_type,
   'skill',i.skill,'prompt',i.prompt,'response',r.response,'answerKey',i.answer_key,'rubric',i.rubric,'score',r.score) order by i.position)
   from public.assessment_responses r join public.assessment_items i on i.id=r.assessment_item_id where r.assessment_attempt_id=c.assessment_attempt_id),'[]'::jsonb));
end $$;

revoke all on function public.save_teacher_entry_draft(uuid,uuid,text,text,text,integer),
 public.finalize_teacher_entry(uuid,uuid,text,text,text,integer),public.teacher_entry_queue(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_teacher_entry_draft(uuid,uuid,text,text,text,integer),
 public.finalize_teacher_entry(uuid,uuid,text,text,text,integer),public.teacher_entry_queue(text,text,text,text,integer) to authenticated;
