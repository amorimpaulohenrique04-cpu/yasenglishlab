-- P17 real PostgreSQL authorization, roster, attendance and audit evidence.
-- The feature is intentionally scoped to TEACHER + AAL2 and the teacher linked to auth.uid().

delete from public.attendance
where session_booking_id in (
  '89500000-0000-4000-8000-000000000001',
  '89500000-0000-4000-8000-000000000002',
  '89500000-0000-4000-8000-000000000003'
);

delete from public.session_bookings
where id in (
  '89500000-0000-4000-8000-000000000001',
  '89500000-0000-4000-8000-000000000002',
  '89500000-0000-4000-8000-000000000003'
);

delete from public.live_sessions
where id in (
  '89400000-0000-4000-8000-000000000001',
  '89400000-0000-4000-8000-000000000002'
);

delete from public.teacher_student_assignments
where id = '89300000-0000-4000-8000-000000000001';

delete from public.teachers
where id in (
  '89200000-0000-4000-8000-000000000001',
  '89200000-0000-4000-8000-000000000002'
);

delete from public.audit_logs
where action = 'attendance_marked'
  and (
    data ->> 'session_booking_id'
  ) in (
    '89500000-0000-4000-8000-000000000001',
    '89500000-0000-4000-8000-000000000002',
    '89500000-0000-4000-8000-000000000003'
  );

insert into auth.users (id, email, raw_user_meta_data)
values
  ('89000000-0000-0000-0000-000000000001', 'teacher-a@example.test', '{"display_name":"Teacher A"}'),
  ('89000000-0000-0000-0000-000000000002', 'teacher-b@example.test', '{"display_name":"Teacher B"}'),
  ('89000000-0000-0000-0000-000000000003', 'teacher-student-a@example.test', '{"display_name":"Student A"}'),
  ('89000000-0000-0000-0000-000000000004', 'teacher-student-b@example.test', '{"display_name":"Student B"}'),
  ('89000000-0000-0000-0000-000000000005', 'teacher-support@example.test', '{"display_name":"Support"}'),
  ('89000000-0000-0000-0000-000000000006', 'teacher-admin@example.test', '{"display_name":"Admin"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('89100000-0000-0000-0000-000000000001', '89000000-0000-0000-0000-000000000001', 'TEACHER'),
  ('89100000-0000-0000-0000-000000000002', '89000000-0000-0000-0000-000000000002', 'TEACHER'),
  ('89100000-0000-0000-0000-000000000003', '89000000-0000-0000-0000-000000000003', 'STUDENT'),
  ('89100000-0000-0000-0000-000000000004', '89000000-0000-0000-0000-000000000004', 'STUDENT'),
  ('89100000-0000-0000-0000-000000000005', '89000000-0000-0000-0000-000000000005', 'SUPPORT'),
  ('89100000-0000-0000-0000-000000000006', '89000000-0000-0000-0000-000000000006', 'ADMIN')
on conflict (id) do nothing;

insert into public.teachers (id, user_id, active)
values
  ('89200000-0000-4000-8000-000000000001', '89000000-0000-0000-0000-000000000001', true),
  ('89200000-0000-4000-8000-000000000002', '89000000-0000-0000-0000-000000000002', true)
on conflict (id) do update set active = true;

insert into public.teacher_student_assignments (
  id, teacher_id, student_user_id, course_id, starts_at
)
values (
  '89300000-0000-4000-8000-000000000001',
  '89200000-0000-4000-8000-000000000001',
  '89000000-0000-0000-0000-000000000003',
  '40000000-0000-4000-8000-000000000001',
  now() - interval '1 day'
)
on conflict (id) do nothing;

insert into public.live_sessions (
  id, teacher_id, session_type, title, starts_at, ends_at, capacity, status
)
values
  (
    '89400000-0000-4000-8000-000000000001',
    '89200000-0000-4000-8000-000000000001',
    'CONVERSATION_LAB',
    'Teacher A own session',
    now() + interval '1 day',
    now() + interval '1 day 1 hour',
    3,
    'SCHEDULED'
  ),
  (
    '89400000-0000-4000-8000-000000000002',
    '89200000-0000-4000-8000-000000000002',
    'CORE_CLASS',
    'Teacher B own session',
    now() + interval '2 days',
    now() + interval '2 days 1 hour',
    3,
    'SCHEDULED'
  )
on conflict (id) do update set
  teacher_id = excluded.teacher_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status;

insert into public.session_bookings (
  id, live_session_id, user_id, status, booked_at, cancelled_at
)
values
  (
    '89500000-0000-4000-8000-000000000001',
    '89400000-0000-4000-8000-000000000001',
    '89000000-0000-0000-0000-000000000003',
    'BOOKED',
    now(),
    null
  ),
  (
    '89500000-0000-4000-8000-000000000002',
    '89400000-0000-4000-8000-000000000002',
    '89000000-0000-0000-0000-000000000004',
    'BOOKED',
    now(),
    null
  ),
  (
    '89500000-0000-4000-8000-000000000003',
    '89400000-0000-4000-8000-000000000001',
    '89000000-0000-0000-0000-000000000004',
    'CANCELLED',
    now(),
    now()
  )
on conflict (id) do update set
  live_session_id = excluded.live_session_id,
  user_id = excluded.user_id,
  status = excluded.status,
  cancelled_at = excluded.cancelled_at;

do $$
begin
  if has_function_privilege('anon', 'public.get_teacher_sessions()', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_teacher_session_roster(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.mark_teacher_attendance(uuid,text)', 'EXECUTE') then
    raise exception 'Anonymous must not execute Teacher Operations RPCs';
  end if;

  if has_table_privilege('authenticated', 'public.attendance', 'INSERT')
    or has_table_privilege('authenticated', 'public.attendance', 'UPDATE') then
    raise exception 'Authenticated must not gain direct attendance DML';
  end if;

  if to_regprocedure('public.get_teacher_sessions(uuid)') is not null then
    raise exception 'Teacher session read model must never accept a teacher id';
  end if;

  if to_regprocedure('public.get_teacher_session_roster(uuid,uuid)') is not null then
    raise exception 'Teacher roster must never accept a teacher id';
  end if;

  if to_regprocedure('public.mark_teacher_attendance(uuid,text,uuid)') is not null then
    raise exception 'Attendance command must never accept actor or teacher identity';
  end if;

  if pg_get_function_result('public.get_teacher_session_roster(uuid)'::regprocedure)
      ~* '(email|phone|user_id|subscription|billing|entitlement|assessment|meeting)' then
    raise exception 'Teacher roster result exposes forbidden identity/commercial/sensitive fields';
  end if;
end;
$$;

set role authenticated;

select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000003', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000003","aal":"aal1"}',
  false
);

do $$
begin
  begin
    perform public.get_teacher_sessions();
    raise exception 'STUDENT must not access Teacher Operations';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000005', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000005","aal":"aal2"}',
  false
);

do $$
begin
  begin
    perform public.get_teacher_sessions();
    raise exception 'SUPPORT without TEACHER must not access Teacher Operations';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000006', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000006","aal":"aal2"}',
  false
);

do $$
begin
  begin
    perform public.get_teacher_sessions();
    raise exception 'ADMIN without TEACHER must not access Teacher Operations';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000001","aal":"aal1"}',
  false
);

do $$
begin
  begin
    perform public.get_teacher_sessions();
    raise exception 'TEACHER at AAL1 must not access Teacher Operations';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mark_teacher_attendance(
      '89500000-0000-4000-8000-000000000001',
      'ATTENDED'
    );
    raise exception 'TEACHER at AAL1 must not mark attendance';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000001","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
  roster_count integer;
begin
  select count(*) into visible_count
  from public.get_teacher_sessions();

  if visible_count <> 1 then
    raise exception 'Teacher A must list exactly the own session';
  end if;

  if exists (
    select 1
    from public.get_teacher_sessions()
    where live_session_id = '89400000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Teacher A read model leaked Teacher B session';
  end if;

  select count(*) into roster_count
  from public.get_teacher_session_roster('89400000-0000-4000-8000-000000000001');

  if roster_count <> 2 then
    raise exception 'Teacher A must receive only the operational roster of the own session';
  end if;

  begin
    perform public.get_teacher_session_roster('89400000-0000-4000-8000-000000000002');
    raise exception 'Teacher A must not read Teacher B roster';
  exception when insufficient_privilege then null;
  end;

  select count(*) into visible_count
  from public.profiles
  where user_id = '89000000-0000-0000-0000-000000000003';

  if visible_count <> 1 then
    raise exception 'Assigned Student must remain available through assignment contract';
  end if;

  select count(*) into visible_count
  from public.profiles
  where user_id = '89000000-0000-0000-0000-000000000004';

  if visible_count <> 0 then
    raise exception 'Unrelated Student must remain hidden from broad pedagogical context';
  end if;
end;
$$;

do $$
declare
  first_id uuid;
  retry_id uuid;
  persisted_status text;
  persisted_actor uuid;
  attendance_count integer;
begin
  select attendance_id into first_id
  from public.mark_teacher_attendance(
    '89500000-0000-4000-8000-000000000001',
    'ATTENDED'
  );

  select attendance_id into retry_id
  from public.mark_teacher_attendance(
    '89500000-0000-4000-8000-000000000001',
    'ATTENDED'
  );

  if first_id is null or first_id <> retry_id then
    raise exception 'Attendance retry must reuse the unique persisted row';
  end if;

  select count(*), max(status), max(marked_by_user_id)
    into attendance_count, persisted_status, persisted_actor
  from public.attendance
  where session_booking_id = '89500000-0000-4000-8000-000000000001';

  if attendance_count <> 1 or persisted_status <> 'ATTENDED' then
    raise exception 'ATTENDED must persist exactly once';
  end if;

  if persisted_actor <> '89000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'marked_by_user_id must derive from authenticated Teacher';
  end if;

  perform public.mark_teacher_attendance(
    '89500000-0000-4000-8000-000000000001',
    'NO_SHOW'
  );

  select status into persisted_status
  from public.attendance
  where session_booking_id = '89500000-0000-4000-8000-000000000001';

  if persisted_status <> 'NO_SHOW' then
    raise exception 'Attendance correction to NO_SHOW must update the same row';
  end if;

  begin
    perform public.mark_teacher_attendance(
      '89500000-0000-4000-8000-000000000002',
      'ATTENDED'
    );
    raise exception 'Teacher A must not mark Teacher B booking';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mark_teacher_attendance(
      '89500000-0000-4000-8000-000000000003',
      'ATTENDED'
    );
    raise exception 'Cancelled booking must not become attendance';
  exception when check_violation then null;
  end;

  begin
    perform public.mark_teacher_attendance(
      '89500000-0000-4000-8000-000000000001',
      'LATE'
    );
    raise exception 'Unsupported attendance state must be rejected';
  exception when check_violation then null;
  end;
end;
$$;

reset role;

insert into public.user_roles (id, user_id, role)
values (
  '89100000-0000-0000-0000-000000000007',
  '89000000-0000-0000-0000-000000000001',
  'ADMIN'
)
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"89000000-0000-0000-0000-000000000001","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.get_teacher_sessions();

  if visible_count <> 1 then
    raise exception 'Multi-role TEACHER + ADMIN must remain Teacher-scoped in Teacher Operations';
  end if;
end;
$$;

reset role;

do $$
declare
  audit_count integer;
  bad_audit_count integer;
  latest_actor uuid;
  latest_data jsonb;
begin
  select count(*) into audit_count
  from public.audit_logs
  where action = 'attendance_marked'
    and data ->> 'session_booking_id' = '89500000-0000-4000-8000-000000000001';

  if audit_count < 3 then
    raise exception 'Attendance INSERT/retry/correction must create durable audit facts';
  end if;

  select actor_user_id, data
    into latest_actor, latest_data
  from public.audit_logs
  where action = 'attendance_marked'
    and data ->> 'session_booking_id' = '89500000-0000-4000-8000-000000000001'
  order by occurred_at desc, id desc
  limit 1;

  if latest_actor <> '89000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Attendance audit actor must derive from authenticated Teacher';
  end if;

  if latest_data ->> 'live_session_id' <> '89400000-0000-4000-8000-000000000001'
    or latest_data ->> 'new_status' <> 'NO_SHOW' then
    raise exception 'Attendance audit must identify session, booking and final state';
  end if;

  select count(*) into bad_audit_count
  from public.audit_logs
  where action = 'attendance_marked'
    and (
      lower(data::text) ~ '(email|phone|password|jwt|token|cookie|secret|meeting|billing|assessment)'
    );

  if bad_audit_count <> 0 then
    raise exception 'Attendance audit contains forbidden PII/secret categories';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'attendance_audit'
      and not tgisinternal
  ) then
    raise exception 'Atomic attendance audit trigger is missing';
  end if;
end;
$$;
