-- Runs after teacher_operations.sql, reusing its own/foreign teacher fixture.
begin;
reset role;
insert into public.live_sessions (teacher_id,session_type,title,starts_at,ends_at,capacity,status)
select '89200000-0000-4000-8000-000000000001','WORKSHOP','Workspace history '||n,
  '2020-01-01T12:00:00Z'::timestamptz+n*interval '1 day',
  '2020-01-01T13:00:00Z'::timestamptz+n*interval '1 day',6,'CANCELLED'
from generate_series(1,105) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','89000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"89000000-0000-0000-0000-000000000003","aal":"aal1"}',true);
do $$ begin
  begin perform public.get_teacher_session_workspace();raise exception 'Student accessed workspace';
  exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','89000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"89000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
do $$ begin
  begin perform public.get_teacher_session_workspace();raise exception 'AAL1 accessed workspace';
  exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"89000000-0000-0000-0000-000000000001","aal":"aal2"}',true);
do $$ declare result jsonb; begin
  result:=public.get_teacher_session_workspace('2020-01-01','2021-01-01');
  if jsonb_array_length(result->'sessions')<>105 then raise exception 'History was truncated';end if;
  if result::text ~ 'meeting_ref|meeting_url|storage_path|assessment' then raise exception 'Sensitive data exposed';end if;
  result:=public.get_teacher_session_workspace(null,null,'89400000-0000-4000-8000-000000000002');
  if jsonb_array_length(result->'sessions')<>0 then raise exception 'Foreign session leaked';end if;
  result:=public.get_teacher_session_workspace(null,null,'89400000-0000-4000-8000-000000000001');
  if jsonb_array_length(result->'sessions')<>1 then raise exception 'Own detail missing';end if;
end $$;
rollback;
