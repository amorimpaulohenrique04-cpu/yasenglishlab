-- Focused, rollback-only smoke using exclusively the existing Entry Demo fixture.
begin;
create function pg_temp.assert_entry(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message; end if; end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated','aal','aal2')::text,true)
from auth.users u where email='teacher.dev@example.test' \gset
select c.id as case_id from public.placement_cases c join auth.users u on u.id=c.user_id
where u.email like '%.entry-demo@example.test' and c.state='REVIEW_PENDING'
and not exists(select 1 from public.placement_review_drafts d where d.placement_case_id=c.id)
order by c.id limit 1 \gset
set local role authenticated;
select pg_temp.assert_entry(jsonb_array_length(public.teacher_entry_queue()->'items')>0,'queue has demo cases');
select pg_temp.assert_entry(jsonb_array_length(public.get_placement_review_evidence(:'case_id')->'responses')>0,'evidence available');
select public.save_teacher_entry_draft(:'case_id',null,null,'Smoke feedback','Personal smoke note',0)->>'revision' as revision \gset
select pg_temp.assert_entry(:'revision'='1','first draft persisted');
select pg_temp.assert_entry((select notes='Personal smoke note' from public.placement_review_drafts where placement_case_id=:'case_id'),'personal notes readable');
select public.save_teacher_entry_draft(:'case_id',null,null,'Updated smoke feedback','Private note',1)->>'revision' as revision \gset
select pg_temp.assert_entry(:'revision'='2','draft resumed with optimistic revision');
do $$ begin
 begin perform public.save_teacher_entry_draft((select placement_case_id from public.placement_review_drafts where feedback='Updated smoke feedback' limit 1),null,null,'stale','stale',0);
 exception when serialization_failure then return; end;
 raise exception 'Stale revision must be denied';
end $$;
reset role;
select id as course_id from public.courses where active and publication_status='PUBLISHED' order by id limit 1 \gset
set local role authenticated;
select public.finalize_teacher_entry(:'case_id',:'course_id','HIGH','Updated smoke feedback','Private note',2) as review_id \gset
select pg_temp.assert_entry(public.finalize_teacher_entry(:'case_id',:'course_id','HIGH','Updated smoke feedback','Private note',2)=:'review_id'::uuid,'identical finalization retry');
do $$ begin
 begin perform public.save_teacher_entry_draft((select placement_case_id from public.placement_review_drafts where feedback='Updated smoke feedback' limit 1),null,null,'overwrite','overwrite',3);
 exception when check_violation then return; end;
 raise exception 'Finalized review must be immutable';
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1"}',true) \gset
set local role authenticated;
do $$ begin
 begin perform public.teacher_entry_queue(); exception when insufficient_privilege then return; end;
 raise exception 'AAL1 must be denied';
end $$;
reset role;
rollback;
select 'Entry smoke passed (all changes rolled back)' as result;
