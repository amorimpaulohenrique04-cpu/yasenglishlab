-- P21.5: private audio and scoped human review; no CEFR or artificial score.
alter table public.practice_results drop constraint practice_results_evaluation_status_check;
alter table public.practice_results add constraint practice_results_evaluation_status_check check(evaluation_status in ('CORRECT','INCORRECT','PENDING_MANUAL','NOT_SCORED','MANUAL_REVIEWED'));

create table public.practice_response_media (
 id uuid primary key default gen_random_uuid(),
 practice_attempt_id uuid not null references public.practice_attempts(id) on delete cascade,
 storage_path text not null unique,
 media_type text not null default 'AUDIO' check(media_type='AUDIO'),
 mime_type text not null check(mime_type in ('audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav')),
 duration_seconds numeric check(duration_seconds>=0),
 size_bytes bigint check(size_bytes between 1 and 26214400),
 upload_status text not null default 'AWAITING_UPLOAD' check(upload_status in ('AWAITING_UPLOAD','READY','SUBMITTED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.practice_manual_reviews (
 id uuid primary key default gen_random_uuid(),
 practice_attempt_id uuid not null unique references public.practice_attempts(id) on delete cascade,
 teacher_id uuid not null references public.teachers(id),
 rubric_version text not null check(rubric_version='v1'),
 ratings jsonb not null check(jsonb_typeof(ratings)='object'),
 feedback text not null check(length(trim(feedback)) between 1 and 4000),
 reviewed_at timestamptz not null default now()
);
create table public.teacher_student_notes (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teachers(id),
 student_user_id uuid not null references auth.users(id), cohort_id uuid references public.cohorts(id),
 live_session_id uuid references public.live_sessions(id), body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.live_session_resources (
 id uuid primary key default gen_random_uuid(),live_session_id uuid not null references public.live_sessions(id),
 resource_type text not null check(resource_type in ('RESOURCE','HOMEWORK')),title text not null check(length(trim(title)) between 1 and 200),
 instructions text not null default '' check(length(instructions)<=4000), due_at timestamptz,
 material_id uuid references public.materials(id),practice_activity_id uuid references public.practice_activities(id),
 external_url text check(external_url ~ '^https://[^/@[:space:]]+([/?#]|$)' and length(external_url)<=2048),
 storage_path text unique,upload_status text not null default 'READY' check(upload_status in ('AWAITING_UPLOAD','READY')),created_at timestamptz not null default now(),
 check(num_nonnulls(material_id,practice_activity_id,external_url,storage_path)<=1)
);
alter table public.practice_response_media enable row level security;
alter table public.practice_manual_reviews enable row level security;
alter table public.teacher_student_notes enable row level security;
alter table public.live_session_resources enable row level security;
revoke all on public.practice_response_media,public.practice_manual_reviews,public.teacher_student_notes,public.live_session_resources from public,anon,authenticated;
grant select on public.practice_manual_reviews,public.teacher_student_notes to authenticated;
grant select(id,live_session_id,resource_type,title,instructions,due_at,material_id,practice_activity_id,external_url,created_at) on public.live_session_resources to authenticated;
create policy manual_review_scope on public.practice_manual_reviews for select to authenticated using(exists(select 1 from public.practice_attempts a where a.id=practice_attempt_id and ((private.has_role('STUDENT',false) and a.user_id=auth.uid()) or private.is_teacher_assigned(a.user_id))));
create policy internal_note_scope on public.teacher_student_notes for select to authenticated using(private.is_teacher_assigned(student_user_id) and exists(select 1 from public.teachers t where t.id=teacher_id and t.user_id=auth.uid() and t.active));
create function private.can_read_session_resource(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_teacher_for_session(p_session) or (private.has_role('STUDENT',false) and exists(select 1 from public.session_bookings where live_session_id=p_session and user_id=auth.uid() and status='BOOKED'));
$$;
create policy session_resource_scope on public.live_session_resources for select to authenticated using(upload_status='READY' and private.can_read_session_resource(live_session_id)
 and (material_id is null or private.can_read_material(material_id))
 and (practice_activity_id is null or private.content_visible('practice_activities',practice_activity_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('yas-practice-responses','yas-practice-responses',false,26214400,array['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav']) on conflict(id) do nothing;

create function public.reserve_practice_audio(p_attempt uuid,p_mime text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=gen_random_uuid(); activity public.practice_activities;
begin
 if not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select p.* into activity from public.practice_attempts a join public.practice_activities p on p.id=a.practice_activity_id where a.id=p_attempt and a.user_id=auth.uid() and a.status='IN_PROGRESS' for update of a;
 if activity.id is null or activity.skill not in ('SPEAKING','PRONUNCIATION') or activity.content->>'kind'<>'MANUAL_AUDIO' then raise exception 'Own audio attempt required' using errcode='42501'; end if;
 insert into public.practice_response_media(id,practice_attempt_id,storage_path,mime_type) values(target,p_attempt,p_attempt||'/'||target,p_mime);
 return target;
end $$;

create function public.authorize_practice_media(p_media uuid,p_upload boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.practice_response_media m join public.practice_attempts a on a.id=m.practice_attempt_id where m.id=p_media and (
  (private.has_role('STUDENT',false) and a.user_id=auth.uid() and (not p_upload or (a.status='IN_PROGRESS' and m.upload_status='AWAITING_UPLOAD')))
  or (not p_upload and a.status='SUBMITTED' and m.upload_status='SUBMITTED' and private.is_teacher_assigned(a.user_id))));
$$;

create function public.complete_practice_audio(p_media uuid) returns void language plpgsql security definer set search_path='' as $$
declare media public.practice_response_media; attempt public.practice_attempts; object_metadata jsonb;
begin
 select a.* into attempt from public.practice_response_media m join public.practice_attempts a on a.id=m.practice_attempt_id where m.id=p_media and a.user_id=auth.uid() for update of a;
 if attempt.id is null or attempt.status<>'IN_PROGRESS' or not private.has_role('STUDENT',false) then raise exception 'Own in-progress attempt required' using errcode='42501'; end if;
 select * into media from public.practice_response_media where id=p_media for update;
 select metadata into object_metadata from storage.objects where bucket_id='yas-practice-responses' and name=media.storage_path;
 if object_metadata is null or object_metadata->>'mimetype' is distinct from media.mime_type or coalesce((object_metadata->>'size')::bigint,0) not between 1 and 26214400 then raise exception 'Valid uploaded audio required' using errcode='23514'; end if;
 update public.practice_response_media set upload_status='READY',size_bytes=(object_metadata->>'size')::bigint,updated_at=now() where id=p_media and upload_status in ('AWAITING_UPLOAD','READY');
end $$;
revoke all on function public.complete_practice_audio(uuid) from public,anon,authenticated;
grant execute on function public.complete_practice_audio(uuid) to authenticated;

alter function private.validate_content(text,jsonb) rename to validate_content_pre_audio;
create function private.validate_content(p_kind text,p_row jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind='practice_activities' and p_row->'content'->>'kind'='MANUAL_AUDIO' then
  if p_row->>'skill' not in ('SPEAKING','PRONUNCIATION') then raise exception 'Audio skill unsupported' using errcode='23514'; end if;
  p_row:=jsonb_set(p_row,'{content,kind}','"MANUAL_TEXT"');
 end if;
 perform private.validate_content_pre_audio(p_kind,p_row);
end $$;
revoke all on function private.validate_content_pre_audio(text,jsonb),private.validate_content(text,jsonb) from public,anon,authenticated;

-- Extend the existing submission entry point; deterministic/manual-text behavior stays in the original body.
alter function public.submit_practice_attempt(uuid,jsonb) rename to submit_practice_attempt_pre_audio;
revoke all on function public.submit_practice_attempt_pre_audio(uuid,jsonb) from public,anon,authenticated;
create function public.submit_practice_attempt(p_practice_attempt_id uuid,p_response jsonb) returns public.practice_results language plpgsql security definer set search_path='' as $$
declare attempt public.practice_attempts; activity public.practice_activities; media public.practice_response_media; result public.practice_results;
begin
 select * into attempt from public.practice_attempts where id=p_practice_attempt_id and user_id=auth.uid() for update;
 if attempt.id is null or not private.has_role('STUDENT',false) then raise exception 'Own Student attempt required' using errcode='42501'; end if;
 select * into activity from public.practice_activities where id=attempt.practice_activity_id;
 if activity.content->>'kind'<>'MANUAL_AUDIO' then return public.submit_practice_attempt_pre_audio(p_practice_attempt_id,p_response); end if;
 if attempt.status='SUBMITTED' then select * into result from public.practice_results where practice_attempt_id=attempt.id; return result; end if;
 if attempt.status<>'IN_PROGRESS' or not activity.active or not private.content_visible('practice_activities',activity.id) or activity.skill not in ('SPEAKING','PRONUNCIATION') then raise exception 'Audio activity unavailable' using errcode='23514'; end if;
 if jsonb_typeof(p_response) is distinct from 'object' or (p_response-'mediaId')<>'{}'::jsonb then raise exception 'Invalid audio response' using errcode='23514'; end if;
 select * into media from public.practice_response_media where id=(p_response->>'mediaId')::uuid and practice_attempt_id=attempt.id for update;
 if media.id is null or media.upload_status<>'READY' then raise exception 'Validated media required' using errcode='23514'; end if;
 insert into public.practice_responses(practice_attempt_id,response) values(attempt.id,jsonb_build_object('mediaId',media.id));
 insert into public.practice_results(practice_attempt_id,score,max_score,feedback,metrics,evaluation_status) values(attempt.id,null,null,'Aguardando revisão do professor.','{"evaluation_mode":"MANUAL_PENDING"}','PENDING_MANUAL') returning * into result;
 update public.practice_response_media set upload_status='SUBMITTED',updated_at=now() where id=media.id;
 update public.practice_attempts set status='SUBMITTED',submitted_at=now() where id=attempt.id;
 return result;
end $$;

create function public.finalize_practice_review(p_attempt uuid,p_ratings jsonb,p_feedback text,p_rubric_version text default 'v1') returns uuid language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); attempt public.practice_attempts; activity public.practice_activities; existing public.practice_manual_reviews; target uuid; dimensions text[];
begin
 select * into attempt from public.practice_attempts where id=p_attempt for update;
 if attempt.id is null or not private.is_teacher_assigned(attempt.user_id) or attempt.status<>'SUBMITTED' then raise exception 'Review unavailable' using errcode='42501'; end if;
 select * into existing from public.practice_manual_reviews where practice_attempt_id=p_attempt;
 if existing.id is not null then
  if existing.teacher_id=teacher and existing.ratings=p_ratings and existing.feedback=trim(p_feedback) and existing.rubric_version=p_rubric_version then return existing.id; end if;
  raise exception 'Review already finalized' using errcode='23505';
 end if;
 select * into activity from public.practice_activities where id=attempt.practice_activity_id;
 if activity.skill not in ('SPEAKING','PRONUNCIATION') or not exists(select 1 from public.practice_results where practice_attempt_id=p_attempt and evaluation_status='PENDING_MANUAL') then raise exception 'Pending manual review required' using errcode='23514'; end if;
 dimensions:=case activity.skill when 'SPEAKING' then array['task_completion','comprehensibility','fluency','language_accuracy','vocabulary_use','pronunciation_intelligibility'] else array['intelligibility','target_sounds','word_stress','sentence_stress_rhythm'] end;
 if p_rubric_version is distinct from 'v1' or jsonb_typeof(p_ratings) is distinct from 'object' or (p_ratings-dimensions)<>'{}'::jsonb
 or exists(select 1 from unnest(dimensions) d where not p_ratings ? d or coalesce(p_ratings->>d,'') not in ('NEEDS_WORK','DEVELOPING','SOLID','STRONG')) then raise exception 'Invalid rubric' using errcode='23514'; end if;
 insert into public.practice_manual_reviews(practice_attempt_id,teacher_id,rubric_version,ratings,feedback) values(p_attempt,teacher,'v1',p_ratings,trim(p_feedback)) returning id into target;
 update public.practice_results set evaluation_status='MANUAL_REVIEWED',feedback=trim(p_feedback),score=null,max_score=null where practice_attempt_id=p_attempt;
 insert into public.notifications(user_id,notification_type,title,body,data,event_key) values(attempt.user_id,'PRACTICE_FEEDBACK_READY','Feedback disponível','Confira sua prática.',jsonb_build_object('practice_attempt_id',p_attempt),p_attempt||':PRACTICE_FEEDBACK_READY') on conflict do nothing;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'PRACTICE_MANUAL_REVIEW','practice_manual_reviews',target,jsonb_build_object('practice_attempt_id',p_attempt,'rubric_version','v1'));
 return target;
end $$;

create function public.get_teacher_reviews(p_attempt uuid default null) returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.current_teacher_id();
 return query select jsonb_build_object('id',a.id,'studentId',a.user_id,'studentName',p.display_name,'title',activity.title,'skill',activity.skill,'prompt',activity.content->>'prompt','response',response.response,'submittedAt',a.submitted_at,'status',result.evaluation_status)
 from public.practice_attempts a join public.practice_activities activity on activity.id=a.practice_activity_id join public.profiles p on p.user_id=a.user_id
 join public.practice_responses response on response.practice_attempt_id=a.id join public.practice_results result on result.practice_attempt_id=a.id
 where private.is_teacher_assigned(a.user_id) and activity.skill in ('SPEAKING','PRONUNCIATION') and (case when p_attempt is null then result.evaluation_status='PENDING_MANUAL' else a.id=p_attempt and result.evaluation_status in ('PENDING_MANUAL','MANUAL_REVIEWED') end)
 order by a.submitted_at,a.id;
end $$;

create function public.create_teacher_note(p_student uuid,p_body text,p_cohort uuid default null,p_session uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); target uuid;
begin
 if not private.is_teacher_assigned(p_student) or (p_cohort is not null and (not private.is_cohort_teacher(p_cohort) or not private.has_cohort_membership(p_cohort,p_student)))
 or (p_session is not null and not private.is_teacher_for_session(p_session)) then raise exception 'Student scope required' using errcode='42501'; end if;
 insert into public.teacher_student_notes(teacher_id,student_user_id,body,cohort_id,live_session_id) values(teacher,p_student,trim(p_body),p_cohort,p_session) returning id into target;
 return target;
end $$;
create function public.create_session_resource(p_session uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform private.current_teacher_id();
 if not private.is_teacher_for_session(p_session) or p_input ? 'storage_path' then raise exception 'Own session required' using errcode='42501'; end if;
 if p_input->>'material_id' is not null and not private.can_read_material((p_input->>'material_id')::uuid) then raise exception 'Material unavailable' using errcode='42501'; end if;
 if p_input->>'practice_activity_id' is not null and not private.content_visible('practice_activities',(p_input->>'practice_activity_id')::uuid) then raise exception 'Practice unavailable' using errcode='42501'; end if;
 insert into public.live_session_resources(live_session_id,resource_type,title,instructions,due_at,material_id,practice_activity_id,external_url)
 values(p_session,p_input->>'resource_type',trim(p_input->>'title'),coalesce(p_input->>'instructions',''),(p_input->>'due_at')::timestamptz,(p_input->>'material_id')::uuid,(p_input->>'practice_activity_id')::uuid,p_input->>'external_url') returning id into target;
 return target;
end $$;

revoke all on function private.can_read_session_resource(uuid) from public,anon;
grant execute on function private.can_read_session_resource(uuid) to authenticated;
revoke all on function public.reserve_practice_audio(uuid,text),public.authorize_practice_media(uuid,boolean),public.submit_practice_attempt(uuid,jsonb),public.finalize_practice_review(uuid,jsonb,text,text),public.get_teacher_reviews(uuid),public.create_teacher_note(uuid,text,uuid,uuid),public.create_session_resource(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_practice_audio(uuid,text),public.authorize_practice_media(uuid,boolean),public.submit_practice_attempt(uuid,jsonb),public.finalize_practice_review(uuid,jsonb,text,text),public.get_teacher_reviews(uuid),public.create_teacher_note(uuid,text,uuid,uuid),public.create_session_resource(uuid,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('yas-session-resources','yas-session-resources',false,26214400,array['application/pdf','text/plain','audio/mpeg','audio/mp4']) on conflict(id) do nothing;
create function public.reserve_session_resource_file(p_session uuid,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=gen_random_uuid();
begin
 perform private.current_teacher_id();
 if not private.is_teacher_for_session(p_session) then raise exception 'Own session required' using errcode='42501'; end if;
 insert into public.live_session_resources(id,live_session_id,resource_type,title,storage_path,upload_status) values(target,p_session,'RESOURCE',trim(p_title),p_session||'/'||target,'AWAITING_UPLOAD');
 return target;
end $$;
create function public.complete_session_resource_file(p_resource uuid) returns void language plpgsql security definer set search_path='' as $$
declare resource public.live_session_resources; metadata jsonb;
begin
 select * into resource from public.live_session_resources where id=p_resource for update;
 if resource.id is null or not private.is_teacher_for_session(resource.live_session_id) then raise exception 'Own resource required' using errcode='42501'; end if;
 select o.metadata into metadata from storage.objects o where o.bucket_id='yas-session-resources' and o.name=resource.storage_path;
 if metadata is null or coalesce((metadata->>'size')::bigint,0) not between 1 and 26214400 or coalesce(metadata->>'mimetype','') not in ('application/pdf','text/plain','audio/mpeg','audio/mp4') then raise exception 'Uploaded resource invalid' using errcode='23514'; end if;
 update public.live_session_resources set upload_status='READY' where id=p_resource;
end $$;
revoke all on function public.reserve_session_resource_file(uuid,text),public.complete_session_resource_file(uuid) from public,anon,authenticated;
grant execute on function public.reserve_session_resource_file(uuid,text),public.complete_session_resource_file(uuid) to authenticated;
