-- PR1 / Block 1E: Google Meet links only, clear cancellation notices, audit trail, notification read state.

CREATE OR REPLACE FUNCTION private.live_state_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event text; recipient uuid; payload jsonb; entity uuid;
begin
 if tg_table_name='session_bookings' then
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  event:=case new.status when 'BOOKED' then 'BOOKING_CONFIRMED' when 'CANCELLED' then 'BOOKING_CANCELLED' else 'LIVE_SESSION_CANCELLED' end;
  new.notification_revision:=case when tg_op='INSERT' then 1 else old.notification_revision+1 end;
  payload:=jsonb_build_object('live_session_id',new.live_session_id,'status',new.status);
  insert into public.notifications(user_id,notification_type,title,body,data,event_key)
  values(new.user_id,event,case when new.status='TEACHER_CANCELLED' then 'Aula cancelada' else 'Sua agenda foi atualizada' end,case when new.status='TEACHER_CANCELLED' then 'Esta aula foi cancelada. Nossa equipe entrará em contato para informar uma nova data.' else 'Confira o estado do encontro na Agenda.' end,payload,new.id||':'||event||':'||new.notification_revision) on conflict do nothing;
 else
  if tg_op='UPDATE' and row(new.status,new.meeting_ref,new.meeting_provider) is not distinct from row(old.status,old.meeting_ref,old.meeting_provider) then return new; end if;
  new.notification_revision:=case when tg_op='INSERT' then 1 else old.notification_revision+1 end;
  event:=case when new.status='CANCELLED' then 'LIVE_SESSION_CANCELLED' when tg_op='INSERT' then 'LIVE_SESSION_AVAILABLE' else 'MEETING_AVAILABLE_OR_UPDATED' end;
  -- A cancellation is announced only to the affected reservations (booking branch above).
  if new.status='CANCELLED' then return new; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_teacher_live_session(p_live_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare student uuid; current_status text;
begin
  if auth.uid() is null or not private.is_teacher_for_session(p_live_session_id) then
    raise exception 'teacher session unavailable' using errcode='42501';
  end if;
  select status into current_status from public.live_sessions where id=p_live_session_id for update;
  if current_status = 'CANCELLED' then return; end if;
  if current_status is distinct from 'SCHEDULED' then
    raise exception 'only scheduled sessions can be cancelled' using errcode='23514';
  end if;
  for student in select distinct user_id from public.session_bookings where live_session_id=p_live_session_id order by user_id loop
    perform private.lock_booking_user(student);
  end loop;
  -- Lock the reservations first: mark_teacher_attendance_v2 only locks the reservation, so a concurrent marking either
  -- commits before this check (and blocks the cancellation) or waits until the cancellation turns the reservation
  -- into TEACHER_CANCELLED (and is then refused because it is no longer BOOKED).
  perform 1 from public.session_bookings where live_session_id=p_live_session_id and status='BOOKED' order by id for update;
  if exists(select 1 from public.session_bookings b join public.attendance a on a.session_booking_id=b.id
    where b.live_session_id=p_live_session_id and b.status='BOOKED') then
    raise exception 'session with recorded attendance cannot be cancelled' using errcode='23514';
  end if;
  update public.session_bookings set status='TEACHER_CANCELLED' where live_session_id=p_live_session_id and status='BOOKED';
  update public.live_sessions set status='CANCELLED' where id=p_live_session_id and status='SCHEDULED';
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
  values(auth.uid(),'TEACHER_SESSION_CANCELLED','live_sessions',p_live_session_id,
   jsonb_build_object('affected_bookings',(select count(*) from public.session_bookings where live_session_id=p_live_session_id and status='TEACHER_CANCELLED')));
end $function$;

CREATE OR REPLACE FUNCTION public.manage_teacher_session(p_id uuid, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if meeting is not null and (length(meeting)>2048 or meeting !~ '^https://meet.google.com/[^/@[:space:]]+' or meeting ~ '[[:cntrl:]]') then raise exception 'Invalid Google Meet URL' using errcode='23514'; end if;
 if p_id is null then
  insert into public.live_sessions(teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,cohort_id,target_student_user_id,meeting_provider,meeting_ref)
  values(teacher,kind,trim(p_input->>'title'),starts,ends,slots,private.session_entitlement(kind),cohort,student,case when meeting is not null then 'MANUAL_EXTERNAL' end,meeting) returning id into target;
 else
  update public.live_sessions set title=trim(coalesce(p_input->>'title',title)),starts_at=starts,ends_at=ends,capacity=slots,cohort_id=cohort,target_student_user_id=student,
  meeting_provider=case when meeting is not null then 'MANUAL_EXTERNAL' end,meeting_ref=meeting where id=p_id;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),case when p_id is null then 'TEACHER_SESSION_CREATE' else 'TEACHER_SESSION_UPDATE' end,'live_sessions',target,
  jsonb_build_object('meeting_link_changed',case when p_id is null then meeting is not null else old_row.meeting_ref is distinct from meeting end));
 return target;
end $function$;

create function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
