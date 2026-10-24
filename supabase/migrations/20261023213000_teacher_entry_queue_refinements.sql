-- Entry review queue refinements (additive; 20261023192114 stays untouched).
--  1. Search also matches the student's cohort (turma), case/accent-insensitive.
--  2. New status filter `completed_today`: finalized today (America/Recife) by the CURRENT teacher.
--  3. KPI `today` is restricted to the current teacher, consistent with filter 2.
--  4. Sort uses the SLA timestamp (state_changed_at = entered review, see review-sla.ts) so order and urgency agree.
-- Security is unchanged: SECURITY DEFINER, empty search_path, AAL2 teacher gate, assignment scope, same grants.

create function private.entry_search_fold(p_text text) returns text
language sql immutable parallel safe set search_path='' as $$
 select translate(lower(coalesce(p_text,'')),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')
$$;
revoke all on function private.entry_search_fold(text) from public,anon,authenticated;

create or replace function public.teacher_entry_queue(p_q text default '',p_status text default 'active',
 p_cohort text default '',p_order text default 'oldest',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; v_q text;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 if p_status not in ('active','all','pending','draft','done','overdue','completed_today') or p_order not in ('oldest','newest') or p_page<1 or p_page>100000 or length(p_q)>120 or length(p_cohort)>160 then raise exception 'Invalid filters' using errcode='22023'; end if;
 v_q:=private.entry_search_fold(p_q);
 with scoped as materialized (
  select c.id,coalesce(p.display_name,'Aluno') as name,
   (select co.name from public.cohort_memberships m join public.cohorts co on co.id=m.cohort_id where m.id=c.membership_id) as cohort,
   a.submitted_at,c.state_changed_at as entered_at,r.finalized_at,
   (r.id is not null and r.actor_user_id=auth.uid()
    and (r.finalized_at at time zone 'America/Recife')::date=(now() at time zone 'America/Recife')::date) as completed_today,
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
   (v_q='' or strpos(private.entry_search_fold(s.name||' '||coalesce(s.cohort,'')||' '||s.skills::text),v_q)>0)
   and (p_cohort='' or s.cohort=p_cohort)
   and (p_status='all' or (p_status='active' and status<>'done') or status=p_status
    or (p_status='overdue' and status<>'done' and entered_at<=now()-interval '24 hours')
    or (p_status='completed_today' and completed_today))
 ), paged as (
  select * from filtered order by
   case when p_order='oldest' then entered_at end asc nulls last,
   case when p_order='newest' then entered_at end desc nulls last,id
  limit 20 offset (p_page-1)*20
 ) select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'cohort',cohort,'submittedAt',submitted_at,
    'enteredReviewAt',entered_at,'status',status,'skills',skills)
    order by case when p_order='oldest' then entered_at end asc nulls last,
     case when p_order='newest' then entered_at end desc nulls last,id) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',p_page,'pageSize',20,
  'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),
   'draft',count(*) filter(where status='draft'),'overdue',count(*) filter(where status<>'done' and entered_at<=now()-interval '24 hours'),
   'today',count(*) filter(where completed_today)) from scoped),
  'cohorts',coalesce((select jsonb_agg(cohort order by cohort) from (select distinct cohort from scoped where cohort is not null) co),'[]'::jsonb)
 ) into result;
 return result;
end $$;
