-- Focused projections, boundary rules and authorization. Every fixture is rolled back.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$ select ('f9900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Students smoke: %',message; end if; end $$;
create function pg_temp.login(n integer,aal text default 'aal2') returns void language sql as $$ select set_config('request.jwt.claim.sub',pg_temp.u(n)::text,true),set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.u(n),'role','authenticated','aal',aal)::text,true) $$;
insert into auth.users(id,email) select pg_temp.u(n),'students-smoke-'||n||'@example.test' from (select generate_series(1,206) n union all select 9001 union all select 9002) ids;
insert into public.profiles(user_id,display_name) select pg_temp.u(n),'Students smoke '||lpad(n::text,3,'0') from generate_series(1,206) n on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.user_roles(user_id,role) select pg_temp.u(n),'STUDENT' from generate_series(1,206) n;
insert into public.user_roles(user_id,role) values(pg_temp.u(9001),'TEACHER'),(pg_temp.u(9002),'TEACHER');
insert into public.teachers(id,user_id) values(pg_temp.u(9001),pg_temp.u(9001)),(pg_temp.u(9002),pg_temp.u(9002));
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) select pg_temp.u(9001),pg_temp.u(n),now()-interval '30 days' from generate_series(1,205) n;
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at,ends_at) values(pg_temp.u(9001),pg_temp.u(206),now()-interval '30 days',now()-interval '1 day');
update public.teacher_student_assignments set starts_at=now()-interval '1 day' where teacher_id=pg_temp.u(9001) and student_user_id=pg_temp.u(2);
update public.teacher_student_assignments set starts_at=now()-interval '7 days' where teacher_id=pg_temp.u(9001) and student_user_id=pg_temp.u(5);
update public.teacher_student_assignments set starts_at=now()-interval '7 days'+interval '1 second' where teacher_id=pg_temp.u(9001) and student_user_id=pg_temp.u(6);
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.u(9002),pg_temp.u(1),now()-interval '30 days');
insert into public.courses(id,slug,title,publication_status,published_at) values(pg_temp.u(1001),'students-smoke-one','Students course one','PUBLISHED',now()),(pg_temp.u(1002),'students-smoke-two','Students course two','PUBLISHED',now());
insert into public.modules(id,course_id,title,position,publication_status,published_at) values(pg_temp.u(1101),pg_temp.u(1001),'Module one',1,'PUBLISHED',now()),(pg_temp.u(1102),pg_temp.u(1002),'Module two',1,'PUBLISHED',now());
insert into public.lessons(id,module_id,title,slug,position,publication_status) values
 (pg_temp.u(1201),pg_temp.u(1101),'Lesson one','students-smoke-one',1,'DRAFT'),(pg_temp.u(1202),pg_temp.u(1101),'Lesson two','students-smoke-two',2,'DRAFT'),
 (pg_temp.u(1203),pg_temp.u(1102),'Custom lesson one','students-smoke-three',1,'DRAFT'),(pg_temp.u(1204),pg_temp.u(1102),'Excluded lesson','students-smoke-four',2,'DRAFT');
insert into public.lesson_assets(lesson_id,asset_type,position,content,publication_status,published_at) select pg_temp.u(n),'TEXT',1,'{"title":"Lesson","body":"Read"}','PUBLISHED',now() from generate_series(1201,1204) n;
update public.lessons set publication_status='PUBLISHED',published_at=now() where id in (pg_temp.u(1201),pg_temp.u(1202),pg_temp.u(1203),pg_temp.u(1204));
insert into public.enrollments(id,user_id,course_id,status,enrolled_at,completed_at) select pg_temp.u(2000+n),pg_temp.u(n),pg_temp.u(1001),case when n=3 then 'COMPLETED' else 'ACTIVE' end,now()-interval '30 days',case when n=3 then now()-interval '10 days' end from unnest(array[1,2,3,5,6,8]) n;
insert into public.enrollments(id,user_id,course_id,status) values(pg_temp.u(2108),pg_temp.u(8),pg_temp.u(1002),'ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values(pg_temp.u(3001),pg_temp.u(1002),'Students custom cohort','students-custom','ACTIVE',now()-interval '30 days');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(pg_temp.u(3001),pg_temp.u(8),pg_temp.u(2108));
insert into public.cohort_paths(cohort_id,mode) values(pg_temp.u(3001),'CUSTOM');
insert into public.cohort_path_items(cohort_id,content_kind,content_id,position) values(pg_temp.u(3001),'modules',pg_temp.u(1102),0),(pg_temp.u(3001),'lessons',pg_temp.u(1203),1);
insert into public.lesson_progress(user_id,enrollment_id,lesson_id,status,completion_percent,last_accessed_at) values
 (pg_temp.u(1),pg_temp.u(2001),pg_temp.u(1201),'IN_PROGRESS',50,now()-interval '8 days'),
 (pg_temp.u(8),pg_temp.u(2108),pg_temp.u(1203),'IN_PROGRESS',50,now()-interval '1 day');
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,status) select pg_temp.u(7000+n),pg_temp.u(9001),'WORKSHOP','Students history '||n,now()-n*interval '2 days',now()-n*interval '2 days'+interval '1 hour',6,'SCHEDULED' from generate_series(1,25) n;
insert into public.session_bookings(id,live_session_id,user_id,booked_at) select pg_temp.u(7500+n),pg_temp.u(7000+n),pg_temp.u(8),now()-n*interval '2 days'-interval '1 day' from generate_series(1,25) n;
update public.live_sessions set status='COMPLETED' where id in (select pg_temp.u(7000+n) from generate_series(1,25) n);
insert into public.attendance(session_booking_id,status) select pg_temp.u(7500+n),'ATTENDED' from generate_series(1,5) n;
select pg_temp.login(9001); set local role authenticated;
select pg_temp.ok((public.teacher_students_workspace()->>'total')::integer=205,'directory exceeds legacy 200 limit, excludes expired assignment');
select pg_temp.ok(jsonb_array_length(public.teacher_students_workspace()->'items')=8,'eight rows per page');
select pg_temp.ok((public.teacher_students_workspace('{"page":26}')->>'total')::integer=205,'totals independent of page');
select pg_temp.ok((select (x->>'total')::integer=205 from (select sum((d->>'total')::integer) as total from jsonb_array_elements(public.teacher_students_workspace()->'distribution') d) v cross join lateral to_jsonb(v) x),'distribution does not duplicate multi-course students');
select pg_temp.ok(public.teacher_student_workspace(pg_temp.u(206)) is null,'expired assignment does not grant profile');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(1))#>>'{student,inactive}')::boolean,'inactive old active enrollment');
select pg_temp.ok(not (public.teacher_student_workspace(pg_temp.u(2))#>>'{student,inactive}')::boolean,'new assignment grace period');
select pg_temp.ok(not (public.teacher_student_workspace(pg_temp.u(3))#>>'{student,inactive}')::boolean,'completed enrollment excluded');
select pg_temp.ok(not (public.teacher_student_workspace(pg_temp.u(4))#>>'{student,inactive}')::boolean,'Entry without enrollment excluded');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(5))#>>'{student,inactive}')::boolean,'exact seven-day boundary');
select pg_temp.ok(not (public.teacher_student_workspace(pg_temp.u(6))#>>'{student,inactive}')::boolean,'one second before seven days');
-- Controlled historical red: the old projection averages only the existing progress row (50%).
select pg_temp.ok((select round(avg(completion_percent))=50 from public.lesson_progress where enrollment_id=pg_temp.u(2001)),'historical sampled formula reproduces misleading 50 percent');
select pg_temp.ok((select (e->>'progress')::integer=25 and (e->>'total')::integer=2 from jsonb_array_elements(public.teacher_student_workspace(pg_temp.u(1))#>'{student,enrollments}') e where e->>'id'=pg_temp.u(2001)::text),'corrected complete denominator yields 25 percent');
select pg_temp.ok((select (e->>'progress')::integer=50 and (e->>'total')::integer=1 from jsonb_array_elements(public.teacher_student_workspace(pg_temp.u(8))#>'{student,enrollments}') e where e->>'id'=pg_temp.u(2108)::text),'custom path denominator excludes other lesson');
select pg_temp.ok((public.teacher_students_workspace(jsonb_build_object('cohort',pg_temp.u(3001)))->>'total')::integer=1,'cohort filter');
select pg_temp.ok(public.teacher_students_workspace('{"q":"Students custom cohort"}')#>>'{items,0,primary_enrollment,title}'='Students course two','matching enrollment context');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities')->>'sessionsTotal')::integer=25,'sessions total counts every booking');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities')->>'eventsTotal')::integer=1,'events total excludes session booking and attendance');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities')->'events') e where e->>'kind'='session'),'events never duplicate sessions');
select pg_temp.ok(public.teacher_student_workspace(pg_temp.u(8),'session',1,'activities')->'events'='[]'::jsonb and (public.teacher_student_workspace(pg_temp.u(8),'session',1,'activities')->>'eventsTotal')::integer=0,'session kind has no event rows');
select pg_temp.ok(jsonb_array_length(public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities',3)->'sessions')=5 and jsonb_array_length(public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities',3)->'events')=1,'sessions page 3 independent of events page 1');
select pg_temp.ok(jsonb_array_length(public.teacher_student_workspace(pg_temp.u(8),'all',2,'activities',1)->'events')=0 and jsonb_array_length(public.teacher_student_workspace(pg_temp.u(8),'all',2,'activities',1)->'sessions')=10,'events page 2 independent of sessions page 1');
select pg_temp.ok(jsonb_array_length(public.teacher_student_workspace(pg_temp.u(8),'all',3,'activities')->'sessions')=5,'omitted sessions page keeps legacy behavior');
select pg_temp.ok((select count(distinct s->>'id')=25 from generate_series(1,3) pg join lateral jsonb_array_elements(public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities',pg)->'sessions') s on true),'session pages do not repeat sessions');
do $$ begin begin perform public.teacher_student_workspace(pg_temp.u(8),'all',1,'activities',0); exception when invalid_parameter_value then return; end; raise exception 'Invalid sessions page must fail'; end $$;
select public.create_teacher_note(pg_temp.u(1),'Internal smoke note') is not null as note_saved \gset
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(1))->>'notesTotal')::integer=1,'own note visible');
select public.request_reassessment(pg_temp.u(4),'Please assess this student again') as request_id \gset
select pg_temp.ok(public.request_reassessment(pg_temp.u(4),'Please assess this student again')=:'request_id'::uuid,'request retry does not duplicate');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(4))#>>'{student,reassessment_open}')::boolean,'open request highlights Entry student');
select pg_temp.ok(public.teacher_student_workspace(pg_temp.u(4))#>'{student,last_activity}'='null'::jsonb,'teacher request is not learning activity');
select pg_temp.ok(public.teacher_students_events()->>'total' is not null,'global events projection');
reset role;
select pg_temp.login(9002); set local role authenticated;
select pg_temp.ok((public.teacher_students_workspace()->>'total')::integer=1,'other teacher only sees own active assignments');
select pg_temp.ok(public.teacher_student_workspace(pg_temp.u(2)) is null,'other teacher cannot read unassigned profile');
select pg_temp.ok((public.teacher_student_workspace(pg_temp.u(1))->>'notesTotal')::integer=0,'shared student does not expose another teacher notes');
do $$ begin begin perform public.create_teacher_note(pg_temp.u(2),'Unauthorized note'); exception when insufficient_privilege then return; end; raise exception 'Unassigned note must fail'; end $$;
reset role;
select pg_temp.login(9001,'aal1'); set local role authenticated;
do $$ begin begin perform public.teacher_students_workspace(); exception when insufficient_privilege then return; end; raise exception 'AAL1 directory must fail'; end $$;
do $$ begin begin perform public.teacher_student_workspace(pg_temp.u(1)); exception when insufficient_privilege then return; end; raise exception 'AAL1 profile must fail'; end $$;
reset role;
rollback;
select 'Students smoke passed; fixture changes rolled back';
