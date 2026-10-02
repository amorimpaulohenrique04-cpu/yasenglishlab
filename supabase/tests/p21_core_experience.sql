-- Real PostgreSQL allow/deny and transactional lifecycle assertions.
begin;
create function pg_temp.p21_assert(ok boolean,message text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception '%',message; end if; end $$;
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','p21-student-a@example.test'),
 ('a1000000-0000-4000-8000-000000000002','p21-student-b@example.test'),
 ('a1000000-0000-4000-8000-000000000003','p21-teacher-a@example.test'),
 ('a1000000-0000-4000-8000-000000000004','p21-teacher-b@example.test'),
 ('a1000000-0000-4000-8000-000000000005','p21-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('a1000000-0000-4000-8000-000000000001','STUDENT'),('a1000000-0000-4000-8000-000000000002','STUDENT'),
 ('a1000000-0000-4000-8000-000000000003','TEACHER'),('a1000000-0000-4000-8000-000000000004','TEACHER'),('a1000000-0000-4000-8000-000000000005','ADMIN');
insert into public.teachers(id,user_id) values('a1100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003'),('a1100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004');
insert into public.enrollments(id,user_id,course_id,status) values
 ('a1200000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','ACTIVE'),
 ('a1200000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.subscriptions(user_id,plan_id,provider,status) values('a1000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000003','test','ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values('a1300000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','P21 A','p21-test-a','ACTIVE',now()-interval '1 day'),('a1300000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','P21 B','p21-test-b','ACTIVE',now()-interval '1 day');
insert into public.cohort_teachers(cohort_id,teacher_id) values('a1300000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001'),('a1300000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000002');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('a1300000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000001'),('a1300000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
do $$begin begin perform public.manage_teacher_availability('CREATE',null,now()+interval '1 minute',now()+interval '3 days');raise exception 'AAL1 availability allowed';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select set_config('p21.availability',public.manage_teacher_availability('CREATE',null,now()+interval '1 minute',now()+interval '3 days')::text,true);
select set_config('p21.group',public.manage_teacher_session(null,jsonb_build_object('title','P21 group','session_type','CORE_CLASS','starts_at',now()+interval '1 day','ends_at',now()+interval '1 day 1 hour','capacity',6,'cohort_id','a1300000-0000-4000-8000-000000000001','meeting_url','https://meet.example.test/p21'))::text,true);
select set_config('p21.private',public.manage_teacher_session(null,jsonb_build_object('title','P21 private','session_type','PRIVATE_SESSION','starts_at',now()+interval '5 minutes','ends_at',now()+interval '50 minutes','capacity',1,'target_student_user_id','a1000000-0000-4000-8000-000000000001','meeting_url','https://meet.example.test/private'))::text,true);
do $$begin
 begin perform public.manage_teacher_session(null,jsonb_build_object('title','Foreign','session_type','CORE_CLASS','starts_at',now()+interval '2 days','ends_at',now()+interval '2 days 1 hour','capacity',6,'cohort_id','a1300000-0000-4000-8000-000000000002'));raise exception 'Foreign cohort allowed';exception when insufficient_privilege then null;end;
 begin perform public.manage_teacher_session(null,jsonb_build_object('title','Overlap','session_type','CORE_CLASS','starts_at',now()+interval '1 day 30 minutes','ends_at',now()+interval '1 day 90 minutes','capacity',6,'cohort_id','a1300000-0000-4000-8000-000000000001'));raise exception 'Overlap allowed';exception when check_violation then null;end;
 begin perform public.manage_teacher_availability('DELETE',current_setting('p21.availability')::uuid);raise exception 'Dependency interval deleted';exception when check_violation then null;end;
end$$;
select pg_temp.p21_assert(jsonb_array_length(public.get_teacher_operation_context()->'students')=1,'Teacher scope must contain only related Student');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.p21_assert(public.get_live_session_join_access(current_setting('p21.private')::uuid)->>'status'='NOT_AUTHORIZED','Booking required for Join');
select set_config('p21.booking',public.book_live_session(current_setting('p21.private')::uuid)::text,true);
select pg_temp.p21_assert(public.get_live_session_join_access(current_setting('p21.private')::uuid)->>'status'='AVAILABLE','Booked in-window Student joins');
select public.book_live_session(current_setting('p21.group')::uuid);
select pg_temp.p21_assert(public.get_live_session_join_access(current_setting('p21.group')::uuid)->>'status'='TOO_EARLY','Student Join window enforced');
select public.cancel_live_booking(current_setting('p21.private')::uuid);
select pg_temp.p21_assert(public.book_live_session(current_setting('p21.private')::uuid)::text=current_setting('p21.booking'),'Rebook identity preserved');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
select pg_temp.p21_assert(not exists(select 1 from public.live_sessions where id=current_setting('p21.private')::uuid),'Private session hidden from other Student');
do $$begin begin perform public.book_live_session(current_setting('p21.private')::uuid);raise exception 'Other Student booked Private';exception when insufficient_privilege then null;end;end$$;
select pg_temp.p21_assert(not has_column_privilege('authenticated','public.live_sessions','meeting_ref','SELECT'),'Meeting URL grant leaked');
select pg_temp.p21_assert(not has_table_privilege('authenticated','public.practice_response_media','SELECT'),'Media paths leaked');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select public.create_teacher_note('a1000000-0000-4000-8000-000000000001','Internal note');
select set_config('p21.resource',public.create_session_resource(current_setting('p21.private')::uuid,'{"resource_type":"HOMEWORK","title":"Practice after class","instructions":"Repeat the target sounds"}')::text,true);
do $$begin begin perform public.manage_teacher_session(current_setting('p21.private')::uuid,jsonb_build_object('ends_at',now()+interval '55 minutes'));raise exception 'Booked structure changed';exception when check_violation then null;end;end$$;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.p21_assert((select count(*) from public.teacher_student_notes)=0,'Student sees internal notes');
select pg_temp.p21_assert(exists(select 1 from public.live_session_resources where id=current_setting('p21.resource')::uuid),'Booked Student resource access');
reset role;
insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content,active,publication_status,published_at) values('a1400000-0000-4000-8000-000000000001','p21-audio','Audio practice','SPEAKING',5,'{"kind":"MANUAL_AUDIO","evaluationMode":"MANUAL_PENDING","prompt":"Describe your day","instructions":"Record a short response"}',true,'PUBLISHED',now());
set local role authenticated;
select set_config('p21.attempt',(public.start_practice_attempt('a1400000-0000-4000-8000-000000000001','a1410000-0000-4000-8000-000000000001')).id::text,true);
select set_config('p21.media',public.reserve_practice_audio(current_setting('p21.attempt')::uuid,'audio/webm')::text,true);
do $$begin begin perform public.complete_practice_audio(current_setting('p21.media')::uuid);raise exception 'Incomplete upload allowed';exception when check_violation then null;end;end$$;
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'yas-practice-responses',storage_path,'{"mimetype":"audio/webm","size":1024}' from public.practice_response_media where id=current_setting('p21.media')::uuid;
set local role authenticated;
select public.complete_practice_audio(current_setting('p21.media')::uuid);
select public.submit_practice_attempt(current_setting('p21.attempt')::uuid,jsonb_build_object('mediaId',current_setting('p21.media')));
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.p21_assert(not public.authorize_practice_media(current_setting('p21.media')::uuid),'Unrelated Teacher audio denied');
select pg_temp.p21_assert(not exists(select 1 from public.get_teacher_reviews(current_setting('p21.attempt')::uuid)),'Unrelated Teacher review hidden');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.p21_assert(public.authorize_practice_media(current_setting('p21.media')::uuid),'Related Teacher audio allowed');
select set_config('p21.ratings','{"task_completion":"SOLID","comprehensibility":"SOLID","fluency":"DEVELOPING","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID","pronunciation_intelligibility":"SOLID"}',true);
select set_config('p21.review',public.finalize_practice_review(current_setting('p21.attempt')::uuid,current_setting('p21.ratings')::jsonb,'Helpful feedback')::text,true);
select pg_temp.p21_assert(public.finalize_practice_review(current_setting('p21.attempt')::uuid,current_setting('p21.ratings')::jsonb,'Helpful feedback')::text=current_setting('p21.review'),'Review retry idempotent');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.p21_assert(exists(select 1 from public.practice_results where practice_attempt_id=current_setting('p21.attempt')::uuid and evaluation_status='MANUAL_REVIEWED' and score is null and max_score is null and feedback='Helpful feedback'),'Review projection transaction');
select pg_temp.p21_assert((select count(*) from public.notifications where notification_type='PRACTICE_FEEDBACK_READY')=1,'Feedback notification idempotent');
reset role;
insert into public.lesson_assets(id,lesson_id,asset_type,position) values('a1500000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','VIDEO',99);
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","aal":"aal2"}',true);
set local role authenticated;
do $$begin begin perform public.admin_content_transition('lesson_assets','a1500000-0000-4000-8000-000000000001','PUBLISHED');raise exception 'Processing VIDEO published';exception when check_violation then null;end;end$$;
select public.prepare_lesson_video_upload('a1500000-0000-4000-8000-000000000001');
reset role;
update public.lesson_video_assets set provider_upload_id='p21-upload',processing_status='UPLOADING' where lesson_asset_id='a1500000-0000-4000-8000-000000000001';
select set_config('p21.video',(select id::text from public.lesson_video_assets where lesson_asset_id='a1500000-0000-4000-8000-000000000001'),true);
select pg_temp.p21_assert(public.process_mux_provider_event('event-ready-early','video.asset.ready',current_setting('p21.video')::uuid,'p21-upload','p21-asset','p21-playback',120,'16:9')='PENDING','Out-of-order ready stays pending');
select public.process_mux_provider_event('event-created','video.upload.asset_created',current_setting('p21.video')::uuid,'p21-upload','p21-asset');
select public.process_mux_provider_event('event-ready-early','video.asset.ready',current_setting('p21.video')::uuid,'p21-upload','p21-asset','p21-playback',120,'16:9');
select public.process_mux_provider_event('event-ready-early','video.asset.ready',current_setting('p21.video')::uuid,'p21-upload','p21-asset','p21-playback',120,'16:9');
select public.process_mux_provider_event('event-error-old','video.asset.errored',current_setting('p21.video')::uuid,'p21-upload','p21-asset');
select pg_temp.p21_assert((select processing_status='READY' from public.lesson_video_assets where id=current_setting('p21.video')::uuid),'Old provider event must not regress READY');
set local role authenticated;
select public.admin_content_transition('lesson_assets','a1500000-0000-4000-8000-000000000001','PUBLISHED');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.p21_assert(public.authorize_lesson_video_playback('a1500000-0000-4000-8000-000000000001'),'Enrolled Student signed playback allowed');
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',0,60);
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',0,30);
select pg_temp.p21_assert((select last_position_seconds=60 from public.lesson_progress where lesson_id='42000000-0000-4000-8000-000000000001'),'Late checkpoint must not reduce position');
rollback;
