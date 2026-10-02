create or replace function private.lock_booking_user(p_user uuid)
returns void language sql volatile set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('yas.booking:' || p_user::text, 0));
$$;

-- Replaced additively in P21.3 with the cohort predicate.
create or replace function private.can_book_session(p_session uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.live_sessions where id = p_session);
$$;

create or replace function private.booking_quota_for_config(p_user uuid, p_key text, p_starts_at timestamptz,
 p_limit numeric, p_cadence text, p_exclude uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare win record; used_units bigint;
begin
  if p_key is null then return jsonb_build_object('cadence','NONE','total',null,'used',0,'remaining',null,'allowed',true); end if;
  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object('allowed',false,'reason','ENTITLEMENT_REQUIRED');
  end if;
  if p_cadence <> 'NONE' and p_limit <> trunc(p_limit) then
    raise exception 'Live recurring entitlement limit must be an integer' using errcode='23514';
  end if;
  select * into win from private.booking_usage_window(p_starts_at,p_cadence);
  select count(*) into used_units from public.session_bookings b
  where b.user_id=p_user and b.entitlement_key_used=p_key
    and (p_exclude is null or b.id<>p_exclude)
    and b.usage_session_starts_at >= win.window_start and b.usage_session_starts_at < win.window_end
    and (b.status='BOOKED' or (b.status='CANCELLED' and
      (b.cancelled_at is null or b.cancelled_at >= b.usage_session_starts_at)));
  return jsonb_build_object('cadence',p_cadence,
    'total',case when p_cadence='NONE' then null else p_limit end,
    'used',used_units,'remaining',case when p_cadence='NONE' then null else greatest(p_limit-used_units,0) end,
    'allowed',p_cadence='NONE' or used_units<p_limit,
    'reason',case when p_cadence<>'NONE' and used_units>=p_limit then 'QUOTA_EXCEEDED' else null end);
end $$;
revoke all on function private.booking_quota_for_config(uuid,text,timestamptz,numeric,text,uuid) from public,anon,authenticated;

create or replace function private.booking_quota(p_user uuid, p_key text, p_starts_at timestamptz, p_exclude uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare config record;
begin
  select * into config from private.booking_entitlement(p_user,p_key,now());
  return private.booking_quota_for_config(p_user,p_key,p_starts_at,config.limit_value,coalesce(config.cadence,'NONE'),p_exclude);
end $$;

create or replace function private.validate_booking()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare session_row public.live_sessions%rowtype; config record; win record; quota jsonb; occupied bigint;
begin
  select * into session_row from public.live_sessions where id=new.live_session_id for update;
  if not found then raise exception 'live session not found' using errcode='23503'; end if;
  perform private.lock_booking_user(new.user_id);
  if tg_op='UPDATE' then
    if new.user_id<>old.user_id or new.live_session_id<>old.live_session_id then
      raise exception 'booking identity is immutable' using errcode='23514';
    end if;
    if new.status=old.status then
      if row(new.entitlement_key_used,new.plan_entitlement_id_used,new.usage_cadence,new.usage_limit,
        new.usage_session_starts_at,new.usage_window_start,new.usage_window_end,new.usage_timezone,new.usage_resolved_at,new.usage_provenance,new.booked_at,new.cancelled_at)
        is distinct from row(old.entitlement_key_used,old.plan_entitlement_id_used,old.usage_cadence,old.usage_limit,
        old.usage_session_starts_at,old.usage_window_start,old.usage_window_end,old.usage_timezone,old.usage_resolved_at,old.usage_provenance,old.booked_at,old.cancelled_at) then
        raise exception 'booking usage snapshot is immutable' using errcode='23514';
      end if;
      return new;
    end if;
    if new.status='BOOKED' and old.status<>'CANCELLED' then
      raise exception 'existing booking is not active' using errcode='23514';
    end if;
  end if;
  if new.status <> 'BOOKED' then
    if tg_op='UPDATE' then
      new.entitlement_key_used := old.entitlement_key_used;
      new.plan_entitlement_id_used := old.plan_entitlement_id_used;
      new.usage_cadence := old.usage_cadence; new.usage_limit := old.usage_limit;
      new.usage_session_starts_at := old.usage_session_starts_at;
      new.usage_window_start := old.usage_window_start; new.usage_window_end := old.usage_window_end;
      new.usage_timezone := old.usage_timezone; new.usage_resolved_at := old.usage_resolved_at;
      new.usage_provenance := old.usage_provenance; new.booked_at := old.booked_at;
    end if;
    new.cancelled_at := clock_timestamp();
    return new;
  end if;
  if session_row.status<>'SCHEDULED' then raise exception 'cannot book a non-scheduled session' using errcode='23514'; end if;
  -- Privileged fixture/history imports may represent already-started sessions; user commands may not.
  if auth.uid() is not null and session_row.starts_at <= clock_timestamp() then
    raise exception 'session already started' using errcode='23514';
  end if;
  if not private.can_book_session(session_row.id,new.user_id) then
    raise exception 'session outside cohort membership' using errcode='42501';
  end if;
  select count(*) into occupied from public.session_bookings b
    where b.live_session_id=new.live_session_id and b.status='BOOKED' and b.id<>new.id;
  if occupied>=session_row.capacity then raise exception 'live session capacity exceeded' using errcode='23514'; end if;
  -- Resolve one configuration for both validation and the persisted snapshot.
  select * into config from private.booking_entitlement(new.user_id,session_row.required_entitlement_key,now());
  quota := private.booking_quota_for_config(new.user_id,session_row.required_entitlement_key,session_row.starts_at,config.limit_value,coalesce(config.cadence,'NONE'),new.id);
  if not (quota->>'allowed')::boolean then
    if quota->>'reason'='ENTITLEMENT_REQUIRED' then raise exception 'required entitlement is not available' using errcode='42501'; end if;
    raise exception 'booking quota exceeded' using errcode='23514';
  end if;
  select * into win from private.booking_usage_window(session_row.starts_at,coalesce(config.cadence,'NONE'));
  new.entitlement_key_used := session_row.required_entitlement_key;
  new.plan_entitlement_id_used := config.config_id;
  new.usage_cadence := coalesce(config.cadence,'NONE'); new.usage_limit := config.limit_value;
  new.usage_session_starts_at := session_row.starts_at;
  new.usage_window_start := win.window_start; new.usage_window_end := win.window_end;
  new.usage_timezone := 'America/Recife'; new.usage_resolved_at := clock_timestamp(); new.usage_provenance := 'COMMAND';
  new.cancelled_at := null;
  if tg_op='UPDATE' then new.booked_at := clock_timestamp(); end if;
  return new;
end $$;
drop trigger session_booking_guard on public.session_bookings;
create trigger session_booking_guard before insert or update on public.session_bookings
  for each row execute function private.validate_booking();

create or replace function public.book_live_session_result(p_live_session_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); booking public.session_bookings%rowtype; booking_id uuid; failure text;
begin
  if actor is null or not private.has_role('STUDENT',false) then raise exception 'student role required' using errcode='42501'; end if;
  perform 1 from public.live_sessions where id=p_live_session_id for update;
  if not found then raise exception 'live session not found' using errcode='23503'; end if;
  perform private.lock_booking_user(actor);
  select * into booking from public.session_bookings where live_session_id=p_live_session_id and user_id=actor for update;
  if found and booking.status='BOOKED' then return jsonb_build_object('booking_id',booking.id,'reason',null); end if;
  if booking.id is not null and booking.status<>'CANCELLED' then raise exception 'existing booking is not active' using errcode='23514'; end if;
  begin
    if booking.id is null then
      insert into public.session_bookings(live_session_id,user_id) values(p_live_session_id,actor) returning id into booking_id;
    else
      update public.session_bookings set status='BOOKED' where id=booking.id returning id into booking_id;
    end if;
  exception when check_violation then
    get stacked diagnostics failure = message_text;
    if failure <> 'booking quota exceeded' then raise; end if;
    insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
      values(actor,'quota_denied','live_session',p_live_session_id,jsonb_build_object('reason','QUOTA_EXCEEDED'));
    return jsonb_build_object('booking_id',null,'reason','QUOTA_EXCEEDED');
  end;
  return jsonb_build_object('booking_id',booking_id,'reason',null);
end $$;

create or replace function public.book_live_session(p_live_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  result := public.book_live_session_result(p_live_session_id);
  if result->>'reason' is not null then raise exception 'booking quota exceeded' using errcode='23514'; end if;
  return (result->>'booking_id')::uuid;
end $$;

create or replace function public.cancel_live_booking(p_live_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); booking_id uuid;
begin
  if actor is null or not private.has_role('STUDENT',false) then raise exception 'student role required' using errcode='42501'; end if;
  perform 1 from public.live_sessions where id=p_live_session_id for update;
  perform private.lock_booking_user(actor);
  select id into booking_id from public.session_bookings where live_session_id=p_live_session_id and user_id=actor for update;
  if booking_id is null then raise exception 'own booking not found' using errcode='42501'; end if;
  update public.session_bookings set status='CANCELLED' where id=booking_id and status='BOOKED';
  return booking_id;
end $$;

create or replace function public.cancel_teacher_live_session(p_live_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare student uuid;
begin
  if auth.uid() is null or not private.is_teacher_for_session(p_live_session_id) then
    raise exception 'teacher session unavailable' using errcode='42501';
  end if;
  perform 1 from public.live_sessions where id=p_live_session_id for update;
  for student in select distinct user_id from public.session_bookings where live_session_id=p_live_session_id order by user_id loop
    perform private.lock_booking_user(student);
  end loop;
  update public.session_bookings set status='TEACHER_CANCELLED' where live_session_id=p_live_session_id and status<>'TEACHER_CANCELLED';
  update public.live_sessions set status='CANCELLED' where id=p_live_session_id and status<>'CANCELLED';
end $$;

create or replace function private.protect_reserved_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if row(new.starts_at,new.required_entitlement_key,new.teacher_id) is distinct from row(old.starts_at,old.required_entitlement_key,old.teacher_id)
    and exists(select 1 from public.session_bookings where live_session_id=old.id) then
    raise exception 'reserved session identity and usage schedule are immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger reserved_session_guard before update on public.live_sessions for each row execute function private.protect_reserved_session();

create or replace function public.get_agenda_sessions_v2()
returns setof jsonb language sql volatile security definer set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object('quota',private.booking_quota(auth.uid(),s.required_entitlement_key,s.starts_at))
    from public.get_agenda_sessions() s;
$$;
revoke all on function private.lock_booking_user(uuid), private.can_book_session(uuid,uuid),
  private.booking_quota(uuid,text,timestamptz,uuid), private.protect_reserved_session() from public,anon,authenticated;
revoke all on function public.book_live_session_result(uuid),public.cancel_live_booking(uuid),
  public.cancel_teacher_live_session(uuid),public.get_agenda_sessions_v2() from public,anon,authenticated;
grant execute on function public.book_live_session_result(uuid),public.cancel_live_booking(uuid),
  public.cancel_teacher_live_session(uuid),public.get_agenda_sessions_v2() to authenticated;
create or replace function private.audit_security_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_id uuid;
  details jsonb;
begin
  entity_id := case when tg_op = 'DELETE' then old.id else new.id end;

  if tg_table_name = 'user_roles' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'role', case when tg_op = 'DELETE' then old.role else new.role end
    );
  elsif tg_table_name = 'plan_entitlements' then
    details := jsonb_build_object(
      'operation', tg_op,
      'plan_id', case when tg_op = 'DELETE' then old.plan_id else new.plan_id end,
      'entitlement_id', case when tg_op = 'DELETE' then old.entitlement_id else new.entitlement_id end,
      'limit_value', case when tg_op = 'DELETE' then old.limit_value else new.limit_value end,
      'cadence', case when tg_op = 'DELETE' then old.cadence else new.cadence end
    );
  elsif tg_table_name = 'subscriptions' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'plan_id', case when tg_op = 'DELETE' then old.plan_id else new.plan_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'cancel_at_period_end',
        case when tg_op = 'DELETE' then old.cancel_at_period_end else new.cancel_at_period_end end
    );
  elsif tg_table_name = 'session_bookings' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'live_session_id',
        case when tg_op = 'DELETE' then old.live_session_id else new.live_session_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end
    );
  elsif tg_table_name = 'lesson_progress' then
    details := jsonb_build_object(
      'operation', tg_op,
      'enrollment_id',
        case when tg_op = 'DELETE' then old.enrollment_id else new.enrollment_id end,
      'lesson_id', case when tg_op = 'DELETE' then old.lesson_id else new.lesson_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'completion_percent',
        case when tg_op = 'DELETE' then old.completion_percent else new.completion_percent end
    );
  else
    details := jsonb_build_object('operation', tg_op);
  end if;

  if tg_table_name = 'session_bookings' then
    if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
    details := details || jsonb_build_object(
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
      'new_status', case when tg_op = 'DELETE' then null else new.status end,
      'previous_usage', case when tg_op = 'UPDATE' then jsonb_build_object('key',old.entitlement_key_used,'cadence',old.usage_cadence,'start',old.usage_window_start,'end',old.usage_window_end,'limit',old.usage_limit) else null end,
      'usage', case when tg_op = 'DELETE' then null else jsonb_build_object('key',new.entitlement_key_used,'cadence',new.usage_cadence,'start',new.usage_window_start,'end',new.usage_window_end,'limit',new.usage_limit) end
    );
  end if;
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    data
  )
  values (
    (select auth.uid()),
    'SECURITY_' || upper(tg_table_name) || '_' || tg_op,
    tg_table_name,
    entity_id,
    details
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


