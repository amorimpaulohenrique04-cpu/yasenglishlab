-- P21.4: additive Teacher-owned operations. Existing booking commands remain authoritative.
alter table public.live_sessions add column target_student_user_id uuid references auth.users(id) on delete restrict;
alter table public.notifications add column event_key text;
create unique index notifications_event_key_unique on public.notifications(user_id,event_key) where event_key is not null;
alter table public.session_bookings add column notification_revision bigint not null default 0;
alter table public.live_sessions add column notification_revision bigint not null default 0;

create table private.live_join_policy (
 id boolean primary key default true check(id),
 before_start_seconds integer not null default 900 check(before_start_seconds between 0 and 3600),
 after_end_seconds integer not null default 900 check(after_end_seconds between 0 and 3600)
);
insert into private.live_join_policy(id) values(true);
revoke all on private.live_join_policy from public,anon,authenticated;

create function private.current_teacher_id() returns uuid language plpgsql stable security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher AAL2 required' using errcode='42501'; end if;
 select id into target from public.teachers where user_id=auth.uid() and active;
 if target is null then raise exception 'Active Teacher required' using errcode='42501'; end if;
 return target;
end $$;

create function private.session_entitlement(p_type text) returns text language sql immutable set search_path='' as $$
 select case p_type when 'CORE_CLASS' then 'weekly_core_classes' when 'CONVERSATION_LAB' then 'weekly_conversation_labs' when 'PRIVATE_SESSION' then 'monthly_private_sessions' end;
$$;

create or replace function private.can_book_session(p_session uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (auth.uid() is null or p_user=auth.uid()) and exists(select 1 from public.live_sessions s where s.id=p_session
 and (s.session_type<>'PRIVATE_SESSION' or s.target_student_user_id=p_user)
 and (s.cohort_id is null or private.has_cohort_membership(s.cohort_id,p_user)));
$$;

drop policy live_sessions_authenticated_select on public.live_sessions;
create policy live_sessions_authenticated_select on public.live_sessions for select to authenticated using(
 (status in ('SCHEDULED','COMPLETED') and cohort_id is null and session_type<>'PRIVATE_SESSION')
 or (private.has_role('STUDENT',false) and private.can_book_session(id,auth.uid()))
 or private.is_teacher_for_session(id)
 or (session_type<>'PRIVATE_SESSION' and private.is_cohort_teacher(cohort_id))
 or private.has_role('SUPPORT',true) or private.has_role('ADMIN',true)
 or exists(select 1 from public.session_bookings b where b.live_session_id=live_sessions.id and b.user_id=auth.uid()));

-- Column grants avoid exposing meeting references through PostgREST.
revoke select on public.live_sessions from authenticated;
grant select(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,cohort_id,created_at,updated_at) on public.live_sessions to authenticated;

create function private.guard_session_v2() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.session_type='PRIVATE_SESSION' and new.target_student_user_id is null then raise exception 'Private session target required' using errcode='23514'; end if;
 if tg_op='UPDATE' and row(new.teacher_id,new.session_type,new.required_entitlement_key,new.starts_at,new.ends_at,new.capacity,new.cohort_id,new.target_student_user_id)
 is distinct from row(old.teacher_id,old.session_type,old.required_entitlement_key,old.starts_at,old.ends_at,old.capacity,old.cohort_id,old.target_student_user_id)
 and exists(select 1 from public.session_bookings where live_session_id=old.id) then
  raise exception 'Reserved session structure is immutable' using errcode='23514';
 end if;
 if new.status='SCHEDULED' and (tg_op='INSERT' or row(new.teacher_id,new.starts_at,new.ends_at,new.status) is distinct from row(old.teacher_id,old.starts_at,old.ends_at,old.status)) then
  -- Lock the Teacher row: concurrent creations cannot both pass the overlap query.
  perform 1 from public.teachers where id=new.teacher_id for update;
  if exists(select 1 from public.live_sessions s where s.teacher_id=new.teacher_id and s.id<>new.id and s.status='SCHEDULED' and s.starts_at<new.ends_at and s.ends_at>new.starts_at) then
   raise exception 'Teacher session overlap' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger session_v2_contract before insert or update on public.live_sessions for each row execute function private.guard_session_v2();

create function public.manage_teacher_availability(p_operation text,p_id uuid,p_starts_at timestamptz default null,p_ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); target uuid:=p_id; old_row public.teacher_availability;
begin
 perform 1 from public.teachers where id=teacher for update;
 if p_operation not in ('CREATE','EDIT','DELETE') then raise exception 'Invalid operation' using errcode='23514'; end if;
 if p_operation<>'CREATE' then
  select * into old_row from public.teacher_availability where id=p_id and teacher_id=teacher for update;
  if old_row.id is null or old_row.starts_at<=now() then raise exception 'Future own interval required' using errcode='42501'; end if;
 end if;
 if p_operation<>'DELETE' and (p_starts_at is null or p_ends_at is null or p_starts_at<=now() or p_ends_at<=p_starts_at) then raise exception 'Invalid future interval' using errcode='23514'; end if;
 if p_operation<>'CREATE' and exists(select 1 from public.live_sessions s where s.teacher_id=teacher and s.status='SCHEDULED' and s.ends_at>now()
  and s.starts_at>=old_row.starts_at and s.ends_at<=old_row.ends_at
  and not (p_operation='EDIT' and s.starts_at>=p_starts_at and s.ends_at<=p_ends_at)
  and not exists(select 1 from public.teacher_availability a where a.teacher_id=teacher and a.id<>p_id and a.starts_at<=s.starts_at and a.ends_at>=s.ends_at)) then
  raise exception 'Interval has scheduled dependencies' using errcode='23514';
 end if;
 if p_operation<>'DELETE' and exists(select 1 from public.teacher_availability where teacher_id=teacher and id is distinct from p_id and starts_at<p_ends_at and ends_at>p_starts_at) then raise exception 'Availability overlap' using errcode='23514'; end if;
 if p_operation='CREATE' then insert into public.teacher_availability(teacher_id,starts_at,ends_at) values(teacher,p_starts_at,p_ends_at) returning id into target;
 elsif p_operation='EDIT' then update public.teacher_availability set starts_at=p_starts_at,ends_at=p_ends_at where id=p_id;
 else delete from public.teacher_availability where id=p_id; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'TEACHER_AVAILABILITY_'||p_operation,'teacher_availability',target,'{}');
 return target;
end $$;

create function public.manage_teacher_session(p_id uuid,p_input jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); target uuid:=p_id; old_row public.live_sessions; kind text; cohort uuid; student uuid; starts timestamptz; ends timestamptz; slots smallint; meeting text;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or p_input ?| array['teacher_id','actor_user_id','required_entitlement_key','status'] then raise exception 'Invalid session input' using errcode='23514'; end if;
 -- Existing session lock precedes Teacher lock, preserving booking's session-first protocol.
 if p_id is not null then
  select * into old_row from public.live_sessions where id=p_id and teacher_id=teacher for update;
  if old_row.id is null or old_row.status<>'SCHEDULED' or old_row.starts_at<=now() then raise exception 'Future own session required' using errcode='42501'; end if;
 end if;
 perform 1 from public.teachers where id=teacher for update;
 kind:=coalesce(p_input->>'session_type',old_row.session_type);
 cohort:=case when p_input ? 'cohort_id' then nullif(p_input->>'cohort_id','')::uuid else old_row.cohort_id end;
 student:=case when p_input ? 'target_student_user_id' then nullif(p_input->>'target_student_user_id','')::uuid else old_row.target_student_user_id end;
 starts:=coalesce((p_input->>'starts_at')::timestamptz,old_row.starts_at);
 ends:=coalesce((p_input->>'ends_at')::timestamptz,old_row.ends_at);
 slots:=coalesce((p_input->>'capacity')::smallint,old_row.capacity);
 meeting:=case when p_input ? 'meeting_url' then nullif(p_input->>'meeting_url','') else old_row.meeting_ref end;
 if private.session_entitlement(kind) is null or starts is null or ends is null or starts<=now() or ends<=starts or slots is null or slots not between 1 and 6
 or length(trim(coalesce(p_input->>'title',old_row.title,''))) not between 1 and 200 then raise exception 'Invalid session' using errcode='23514'; end if;
 if p_id is not null and kind<>old_row.session_type then raise exception 'Session type immutable' using errcode='23514'; end if;
 if kind='PRIVATE_SESSION' then
  if slots<>1 or student is null or cohort is not null or not private.is_teacher_assigned(student)
   or not exists(select 1 from public.user_roles where user_id=student and role='STUDENT') then raise exception 'Private target unavailable' using errcode='42501'; end if;
 elsif cohort is null or student is not null or not private.is_cohort_teacher(cohort) then raise exception 'Authorized Cohort required' using errcode='42501'; end if;
 if not exists(select 1 from public.teacher_availability where teacher_id=teacher and starts_at<=starts and ends_at>=ends) then raise exception 'Availability required' using errcode='23514'; end if;
 if meeting is not null and (length(meeting)>2048 or meeting !~ '^https://[^/@[:space:]]+([/?#]|$)' or meeting ~ '[[:cntrl:]]') then raise exception 'Invalid HTTPS meeting URL' using errcode='23514'; end if;
 if p_id is null then
  insert into public.live_sessions(teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,cohort_id,target_student_user_id,meeting_provider,meeting_ref)
  values(teacher,kind,trim(p_input->>'title'),starts,ends,slots,private.session_entitlement(kind),cohort,student,case when meeting is not null then 'MANUAL_EXTERNAL' end,meeting) returning id into target;
 else
  update public.live_sessions set title=trim(coalesce(p_input->>'title',title)),starts_at=starts,ends_at=ends,capacity=slots,cohort_id=cohort,target_student_user_id=student,
  meeting_provider=case when meeting is not null then 'MANUAL_EXTERNAL' end,meeting_ref=meeting where id=p_id;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),case when p_id is null then 'TEACHER_SESSION_CREATE' else 'TEACHER_SESSION_UPDATE' end,'live_sessions',target,'{}');
 return target;
end $$;

create function public.get_live_session_join_reference(p_session_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare session public.live_sessions;
begin
 select * into session from public.live_sessions where id=p_session_id;
 if session.id is null or not (private.is_teacher_for_session(p_session_id) or (private.has_role('STUDENT',false) and exists(select 1 from public.session_bookings where live_session_id=p_session_id and user_id=auth.uid() and status='BOOKED'))) then
  return jsonb_build_object('status','NOT_AUTHORIZED');
 end if;
 return jsonb_build_object('status',session.status,'startsAt',session.starts_at,'endsAt',session.ends_at,'provider',session.meeting_provider,'reference',session.meeting_ref,'teacher',private.is_teacher_for_session(p_session_id));
end $$;
-- Reference resolver is server-only. Authenticated clients cannot call it directly.
revoke all on function public.get_live_session_join_reference(uuid) from public,anon,authenticated;
-- A public RPC must itself enforce the window; server passes only bounds, never authority.
create function public.get_live_session_join_access(p_session_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; policy private.live_join_policy;
begin
 result:=public.get_live_session_join_reference(p_session_id);
 select * into strict policy from private.live_join_policy where id;
 if result->>'status'='NOT_AUTHORIZED' then return result; end if;
 if result->>'status'<>'SCHEDULED' then return jsonb_build_object('status','SESSION_CLOSED'); end if;
 -- Database protects direct invocation too; server domain constant uses the same documented V1 window.
 if not (result->>'teacher')::boolean and now()<(result->>'startsAt')::timestamptz-make_interval(secs=>policy.before_start_seconds) then return jsonb_build_object('status','TOO_EARLY'); end if;
 if now()>(result->>'endsAt')::timestamptz+make_interval(secs=>policy.after_end_seconds) then return jsonb_build_object('status','SESSION_CLOSED'); end if;
 if result->>'provider' is distinct from 'MANUAL_EXTERNAL' or result->>'reference' is null then return jsonb_build_object('status','MEETING_NOT_READY'); end if;
 return jsonb_build_object('status','AVAILABLE','url',result->>'reference');
end $$;

create function public.get_teacher_operation_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb;
begin
 select jsonb_build_object(
  'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id) from public.cohorts c where private.is_cohort_teacher(c.id)),'[]'::jsonb),
  'students',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.display_name) order by p.display_name,p.user_id) from public.profiles p where private.is_teacher_assigned(p.user_id)),'[]'::jsonb),
  'availability',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'starts_at',a.starts_at,'ends_at',a.ends_at) order by a.starts_at,a.id) from public.teacher_availability a where a.teacher_id=teacher),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'session_type',s.session_type,'starts_at',s.starts_at,'ends_at',s.ends_at,'capacity',s.capacity,'cohort_id',s.cohort_id,'target_student_user_id',s.target_student_user_id,'has_bookings',exists(select 1 from public.session_bookings where live_session_id=s.id)) order by s.starts_at,s.id) from public.live_sessions s where s.teacher_id=teacher),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.get_teacher_operation_context() from public,anon,authenticated;
grant execute on function public.get_teacher_operation_context() to authenticated;

create function private.live_state_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare event text; recipient uuid; payload jsonb; entity uuid;
begin
 if tg_table_name='session_bookings' then
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  event:=case new.status when 'BOOKED' then 'BOOKING_CONFIRMED' when 'CANCELLED' then 'BOOKING_CANCELLED' else 'LIVE_SESSION_CANCELLED' end;
  new.notification_revision:=case when tg_op='INSERT' then 1 else old.notification_revision+1 end;
  payload:=jsonb_build_object('live_session_id',new.live_session_id,'status',new.status);
  insert into public.notifications(user_id,notification_type,title,body,data,event_key)
  values(new.user_id,event,'Sua agenda foi atualizada','Confira o estado do encontro na Agenda.',payload,new.id||':'||event||':'||new.notification_revision) on conflict do nothing;
 else
  if tg_op='UPDATE' and row(new.status,new.meeting_ref,new.meeting_provider) is not distinct from row(old.status,old.meeting_ref,old.meeting_provider) then return new; end if;
  new.notification_revision:=case when tg_op='INSERT' then 1 else old.notification_revision+1 end;
  event:=case when new.status='CANCELLED' then 'LIVE_SESSION_CANCELLED' when tg_op='INSERT' then 'LIVE_SESSION_AVAILABLE' else 'MEETING_AVAILABLE_OR_UPDATED' end;
  entity:=new.id; payload:=jsonb_build_object('live_session_id',entity,'status',new.status,'starts_at',new.starts_at);
  for recipient in
   select b.user_id from public.session_bookings b where b.live_session_id=entity
   union select m.user_id from public.cohort_memberships m where m.cohort_id=new.cohort_id and private.has_cohort_membership(new.cohort_id,m.user_id)
   union select new.target_student_user_id where new.target_student_user_id is not null
  loop
   insert into public.notifications(user_id,notification_type,title,body,data,event_key) values(recipient,event,'Encontro atualizado','Confira sua Agenda.',payload,entity||':'||event||':'||new.notification_revision) on conflict do nothing;
  end loop;
 end if;
 return new;
end $$;
create trigger booking_state_notifications before insert or update on public.session_bookings for each row execute function private.live_state_notifications();
create trigger session_state_notifications before insert or update on public.live_sessions for each row execute function private.live_state_notifications();

revoke all on function private.current_teacher_id(),private.session_entitlement(text),private.guard_session_v2(),private.live_state_notifications() from public,anon,authenticated;
revoke all on function public.manage_teacher_session(uuid,jsonb),public.manage_teacher_availability(text,uuid,timestamptz,timestamptz),public.get_live_session_join_access(uuid) from public,anon,authenticated;
grant execute on function public.manage_teacher_session(uuid,jsonb),public.manage_teacher_availability(text,uuid,timestamptz,timestamptz),public.get_live_session_join_access(uuid) to authenticated;
