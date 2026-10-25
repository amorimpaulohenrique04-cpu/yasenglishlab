-- Teacher Entry review queue: scope, filters, search (name/turma), per-teacher "completed today", SLA ordering,
-- draft optimistic revision and finalization. Every fixture is rolled back.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$ select ('f9a00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Entry queue: %',message; end if; end $$;
create function pg_temp.login(n integer,aal text default 'aal2') returns void language sql as $$ select set_config('request.jwt.claim.sub',pg_temp.u(n)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.u(n),'role','authenticated','aal',aal)::text,true) $$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command; exception when others then if sqlstate=expected then return; else raise; end if; end;
 raise exception 'Expected denial % for: %',expected,command;
end $$;
create function pg_temp.names(q jsonb) returns text language sql as $$ select coalesce(string_agg(i->>'name',',' order by ord),'') from jsonb_array_elements(q->'items') with ordinality t(i,ord) $$;

-- Users: 1..7 students, 9001/9002 teachers.
insert into auth.users(id,email) select pg_temp.u(n),'entry-ws-'||n||'@example.test' from (select generate_series(1,7) n union all select 9001 union all select 9002) ids;
insert into public.profiles(user_id,display_name) values
 (pg_temp.u(1),'Ana '||U&'\00C1'||'lvares'),(pg_temp.u(2),'Bruno Costa'),(pg_temp.u(3),'Carla Dias'),(pg_temp.u(4),'Diego Lima'),
 (pg_temp.u(5),'Eva Fora'),(pg_temp.u(6),'Fabio Ontem'),(pg_temp.u(7),'Gabi Meia-noite')
 on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.user_roles(user_id,role) select pg_temp.u(n),'STUDENT' from generate_series(1,7) n on conflict do nothing;
insert into public.user_roles(user_id,role) values(pg_temp.u(9001),'TEACHER'),(pg_temp.u(9002),'TEACHER') on conflict do nothing;
insert into public.teachers(id,user_id) values(pg_temp.u(9001),pg_temp.u(9001)),(pg_temp.u(9002),pg_temp.u(9002));
-- Teacher 1: students 1,2,3,4,6,7. Teacher 2: students 4 (shared) and 5.
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) select pg_temp.u(9001),pg_temp.u(n),now()-interval '30 days' from unnest(array[1,2,3,4,6,7]) n;
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) select pg_temp.u(9002),pg_temp.u(n),now()-interval '30 days' from unnest(array[4,5]) n;
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) select pg_temp.u(n),'10000000-0000-0000-0000-000000000001','test','entry-ws-'||n,'ACTIVE' from generate_series(1,7) n;
insert into public.assessments(id,slug,title,purpose,is_placement) values(pg_temp.u(100),'entry-ws-fixture','Entry fixture','Synthetic evidence; no CEFR',false);
insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values(pg_temp.u(101),pg_temp.u(100),1,'DRAFT','{}','{}');
insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key,rubric) values
 (pg_temp.u(102),pg_temp.u(101),1,'GRAMMAR','MANUAL_TEXT','{"prompt":"Explain"}',null,'{}');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 (pg_temp.u(200),'40000000-0000-4000-8000-000000000001','Turma Aurora','entry-ws-aurora','ACTIVE',now()-interval '1 day');
-- Fixture only: build the cases directly with controlled timestamps (triggers bypassed, rolled back).
set local session_replication_role = replica;
insert into public.enrollments(id,user_id,course_id,status) select pg_temp.u(300+n),pg_temp.u(n),'40000000-0000-4000-8000-000000000001','ACTIVE' from unnest(array[1,2]) n;
insert into public.cohort_memberships(id,cohort_id,user_id,enrollment_id) select pg_temp.u(400+n),pg_temp.u(200),pg_temp.u(n),pg_temp.u(300+n) from unnest(array[1,2]) n;
-- Submitted date deliberately inverts the SLA order: the oldest review wait has the newest submission.
insert into public.assessment_attempts(id,user_id,assessment_version_id,status,started_at,submitted_at) values
 (pg_temp.u(500+1),pg_temp.u(1),pg_temp.u(101),'SUBMITTED',now()-interval '31 hours',now()-interval '1 hour'),
 (pg_temp.u(500+2),pg_temp.u(2),pg_temp.u(101),'SUBMITTED',now()-interval '60 hours',now()-interval '50 hours'),
 (pg_temp.u(500+3),pg_temp.u(3),pg_temp.u(101),'SUBMITTED',now()-interval '9 hours',now()-interval '5 hours'),
 (pg_temp.u(500+4),pg_temp.u(4),pg_temp.u(101),'SUBMITTED',now()-interval '9 hours',now()-interval '3 hours'),
 (pg_temp.u(500+5),pg_temp.u(5),pg_temp.u(101),'SUBMITTED',now()-interval '9 hours',now()-interval '2 hours'),
 (pg_temp.u(500+6),pg_temp.u(6),pg_temp.u(101),'SUBMITTED',now()-interval '9 days',now()-interval '8 days'),
 (pg_temp.u(500+7),pg_temp.u(7),pg_temp.u(101),'SUBMITTED',now()-interval '9 days',now()-interval '8 days');
insert into public.placement_cases(id,user_id,subscription_id,assessment_attempt_id,membership_id,state,state_changed_at)
 select pg_temp.u(600+n),pg_temp.u(n),(select id from public.subscriptions where provider_subscription_id='entry-ws-'||n),pg_temp.u(500+n),
  case when n in (1,2) then pg_temp.u(400+n) end,
  case when n in (6,7) then 'PLACEMENT_READY' else 'REVIEW_PENDING' end,
  case n when 1 then now()-interval '30 hours' when 2 then now()-interval '10 hours' when 3 then now()-interval '5 hours'
   when 4 then now()-interval '3 hours' when 5 then now()-interval '2 hours' else now()-interval '2 days' end
 from generate_series(1,7) n;
-- Student 6 was finalized by Teacher 1 at the last second of YESTERDAY (Recife); student 7 at today's first instant.
insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance,finalized_at) values
 (pg_temp.u(606),'40000000-0000-4000-8000-000000000001',pg_temp.u(9001),'Yesterday review','HIGH','{}',
  ((now() at time zone 'America/Recife')::date::timestamp at time zone 'America/Recife')-interval '1 second'),
 (pg_temp.u(607),'40000000-0000-4000-8000-000000000001',pg_temp.u(9001),'Midnight review','HIGH','{}',
  ((now() at time zone 'America/Recife')::date::timestamp at time zone 'America/Recife'));
set local session_replication_role = origin;

-- Teacher 1, AAL2.
select pg_temp.login(9001); set local role authenticated;
select pg_temp.ok((public.teacher_entry_queue('', 'all')->>'total')::integer=6,'teacher sees only in-scope cases (student 5 excluded)');
select pg_temp.ok(position('Eva' in pg_temp.names(public.teacher_entry_queue('','all')))=0,'out-of-scope student never listed');
select pg_temp.ok((public.teacher_entry_queue()->>'total')::integer=4,'active excludes finalized');
-- Order and urgency share the entered-review timestamp, not the submission date.
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue())='Ana '||U&'\00C1'||'lvares,Bruno Costa,Carla Dias,Diego Lima','oldest orders by entered-review time (submission order would differ)');
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','active','','newest'))='Diego Lima,Carla Dias,Bruno Costa,Ana '||U&'\00C1'||'lvares','newest reverses the same timestamp');
select pg_temp.ok((public.teacher_entry_queue('','overdue')->>'total')::integer=1 and public.teacher_entry_queue('','overdue')#>>'{items,0,name}' like 'Ana%','overdue filter matches 24h SLA from entered-review time');
-- Search by name (case/accent-insensitive) and by turma.
select pg_temp.ok((public.teacher_entry_queue('alvares','all')->>'total')::integer=1,'search ignores accents');
select pg_temp.ok((public.teacher_entry_queue(U&'\00C1LVARES','all')->>'total')::integer=1,'search ignores case with accented input');
select pg_temp.ok((public.teacher_entry_queue('bruno','all')->>'total')::integer=1,'search by name');
select pg_temp.ok((public.teacher_entry_queue('AURORA','all')->>'total')::integer=2,'search by turma name');
select pg_temp.ok((public.teacher_entry_queue('turma aurora','all')->>'total')::integer=2,'search by full turma name');
select pg_temp.ok((public.teacher_entry_queue('zzz-none','all')->>'total')::integer=0,'search without match');
select pg_temp.ok((public.teacher_entry_queue('','all','Turma Aurora')->>'total')::integer=2,'exact cohort filter retained');
-- Draft with optimistic revision.
select pg_temp.ok((public.save_teacher_entry_draft(pg_temp.u(602),null,null,'Draft feedback','Private',0)->>'revision')::integer=1,'first draft revision 1');
select pg_temp.ok((public.save_teacher_entry_draft(pg_temp.u(602),null,'MEDIUM','Draft feedback 2','Private',1)->>'revision')::integer=2,'draft resumes with revision 2');
select pg_temp.denied(format('select public.save_teacher_entry_draft(%L,null,null,%L,%L,1)',pg_temp.u(602),'stale','stale'),'40001');
select pg_temp.ok((select feedback='Draft feedback 2' from public.placement_review_drafts where placement_case_id=pg_temp.u(602)),'stale save did not overwrite');
select pg_temp.ok((public.teacher_entry_queue('','draft')->>'total')::integer=1,'draft filter');
select pg_temp.ok((public.teacher_entry_queue()->'counts'->>'pending')::integer=3 and (public.teacher_entry_queue()->'counts'->>'draft')::integer=1 and (public.teacher_entry_queue()->'counts'->>'overdue')::integer=1,'KPI pending/draft/overdue');
-- Completed today: only this teacher, Recife day boundaries.
select pg_temp.ok((public.teacher_entry_queue()->'counts'->>'today')::integer=1,'KPI today counts own midnight-boundary review, not yesterday');
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','completed_today'))='Gabi Meia-noite','completed_today filter: own review at the start of the Recife day only');
-- Finalize happy path, idempotent retry and rejection of conflicting re-finalize.
select public.finalize_teacher_entry(pg_temp.u(603),'40000000-0000-4000-8000-000000000001','HIGH','Final feedback','Private note',0) as review_id \gset
select pg_temp.ok(:'review_id' is not null,'finalize returns a review id');
select pg_temp.ok(public.finalize_teacher_entry(pg_temp.u(603),'40000000-0000-4000-8000-000000000001','HIGH','Final feedback','Private note',1)=:'review_id'::uuid,'identical retry returns the same review');
select pg_temp.denied(format('select public.finalize_teacher_entry(%L,%L,%L,%L,%L,1)',pg_temp.u(603),'40000000-0000-4000-8000-000000000001','LOW','Different feedback','x'),'23514');
select pg_temp.denied(format('select public.save_teacher_entry_draft(%L,null,null,%L,%L,0)',pg_temp.u(603),'late','late'),'23514');
select pg_temp.ok((select state='PLACEMENT_READY' from public.placement_cases where id=pg_temp.u(603)),'finalized case moves to PLACEMENT_READY');
select pg_temp.ok((select count(*)=1 from public.placement_reviews where placement_case_id=pg_temp.u(603)),'single immutable review');
select pg_temp.ok((public.teacher_entry_queue()->'counts'->>'today')::integer=2,'KPI today includes the new finalization');
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','completed_today'))='Carla Dias,Gabi Meia-noite' or pg_temp.names(public.teacher_entry_queue('','completed_today'))='Gabi Meia-noite,Carla Dias','completed_today lists both own reviews');
select pg_temp.ok((public.teacher_entry_queue('','done')->>'total')::integer=3,'done filter keeps all finalized in scope');
select pg_temp.denied(format('select public.finalize_teacher_entry(%L,%L,%L,%L,%L,0)',pg_temp.u(605),'40000000-0000-4000-8000-000000000001','HIGH','Out of scope','x'));
select pg_temp.denied(format('select public.save_teacher_entry_draft(%L,null,null,%L,%L,0)',pg_temp.u(605),'x','x'));
select pg_temp.denied('select public.teacher_entry_queue('''',''bogus'')','22023');
reset role;

-- Teacher 2 finalizes the shared student; that must not count for Teacher 1.
select pg_temp.login(9002); set local role authenticated;
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','all')) like '%Diego Lima%' and pg_temp.names(public.teacher_entry_queue('','all')) like '%Eva Fora%' and pg_temp.names(public.teacher_entry_queue('','all')) not like '%Ana%','teacher 2 sees only own assignments');
select pg_temp.ok((public.teacher_entry_queue()->'counts'->>'draft')::integer=0,'another teacher draft is not visible');
select public.save_teacher_entry_draft(pg_temp.u(605),null,null,'T2 private draft','T2 note',0);
select public.finalize_teacher_entry(pg_temp.u(604),'40000000-0000-4000-8000-000000000001','MEDIUM','T2 feedback','T2 note',0) is not null as t2_final \gset
select pg_temp.ok((select count(*)=0 from public.placement_review_drafts where teacher_id<>auth.uid()),'draft RLS hides other teachers rows');
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','completed_today'))='Diego Lima' and (public.teacher_entry_queue()->'counts'->>'today')::integer=1,'teacher 2 completed_today and KPI only count own review');
select pg_temp.denied(format('select public.save_teacher_entry_draft(%L,null,null,%L,%L,0)',pg_temp.u(601),'x','x'));
reset role;

select pg_temp.login(9001); set local role authenticated;
select pg_temp.ok((public.teacher_entry_queue()->'counts'->>'today')::integer=2,'teacher 1 KPI unaffected by teacher 2 finalization');
select pg_temp.ok(pg_temp.names(public.teacher_entry_queue('','completed_today')) not like '%Diego%','teacher 1 completed_today excludes another teacher review');
select pg_temp.ok((select count(*)=0 from public.placement_review_drafts where placement_case_id=pg_temp.u(605)),'teacher 1 cannot read teacher 2 draft');
select pg_temp.ok((public.teacher_entry_queue('','done')->>'total')::integer=4,'done filter still lists the review finalized by another teacher');
reset role;

-- Denials: student, teacher without AAL2.
select pg_temp.login(1); set local role authenticated;
select pg_temp.denied('select public.teacher_entry_queue()');
select pg_temp.denied(format('select public.save_teacher_entry_draft(%L,null,null,%L,%L,0)',pg_temp.u(601),'x','x'));
reset role;
select pg_temp.login(9001,'aal1'); set local role authenticated;
select pg_temp.denied('select public.teacher_entry_queue()');
select pg_temp.denied('select public.teacher_entry_queue('''',''completed_today'')');
select pg_temp.denied(format('select public.finalize_teacher_entry(%L,%L,%L,%L,%L,0)',pg_temp.u(601),'40000000-0000-4000-8000-000000000001','HIGH','x','x'));
reset role;
rollback;
select 'Teacher entry workspace smoke passed; fixture changes rolled back';
