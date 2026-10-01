alter table public.lesson_assets add column updated_at timestamptz not null default now();

-- P18: editorial publication is separate from operational availability.
do $$
declare t text;
begin
  foreach t in array array['courses','modules','lessons','lesson_assets','materials','practice_activities'] loop
    execute format('alter table public.%I add column publication_status text not null default ''DRAFT'' check (publication_status in (''DRAFT'', ''PUBLISHED'')), add column published_at timestamptz, add constraint %I check ((publication_status = ''DRAFT'' and published_at is null) or (publication_status = ''PUBLISHED'' and published_at is not null))', t, t || '_publication_timestamp');
    execute format('grant select (publication_status, published_at) on public.%I to authenticated', t);
  end loop;
end $$;

create function private.content_visible(p_kind text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  case p_kind
    when 'courses' then return exists (select 1 from public.courses c where c.id=p_id and c.active and c.publication_status='PUBLISHED');
    when 'modules' then return exists (select 1 from public.modules m where m.id=p_id and m.publication_status='PUBLISHED' and private.content_visible('courses',m.course_id));
    when 'lessons' then return exists (select 1 from public.lessons l where l.id=p_id and l.publication_status='PUBLISHED' and private.content_visible('modules',l.module_id));
    when 'lesson_assets' then return exists (select 1 from public.lesson_assets a where a.id=p_id and a.publication_status='PUBLISHED' and private.content_visible('lessons',a.lesson_id));
    when 'materials' then return exists (select 1 from public.materials m where m.id=p_id and m.active and m.publication_status='PUBLISHED' and (m.module_id is null or private.content_visible('modules',m.module_id)) and (m.lesson_id is null or private.content_visible('lessons',m.lesson_id)));
    when 'practice_activities' then return exists (select 1 from public.practice_activities p where p.id=p_id and p.active and p.publication_status='PUBLISHED' and (p.related_module_id is null or private.content_visible('modules',p.related_module_id)) and (p.related_lesson_id is null or private.content_visible('lessons',p.related_lesson_id)));
    else return false;
  end case;
end $$;

-- Existing enrollment/entitlement checks stay intact; draft bypass is Admin-only.
create or replace function private.can_read_material(p_material_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
select exists (select 1 from public.materials m where m.id=p_material_id and (
  private.has_role('ADMIN',true) or (private.content_visible('materials',m.id) and (
    private.has_role('TEACHER',true) or (
      (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key)) and (
        (m.module_id is null and m.lesson_id is null) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id
          where e.user_id=auth.uid() and e.status='ACTIVE' and mo.id=m.module_id
        ) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id join public.lessons l on l.module_id=mo.id
          where e.user_id=auth.uid() and e.status='ACTIVE' and l.id=m.lesson_id
        )
      )
    )
  ))
));
$$;
create or replace function private.can_read_lesson_asset(p_lesson_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
select exists (select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id join public.modules m on m.id=l.module_id
where a.id=p_lesson_asset_id and (private.has_role('ADMIN',true) or (
 private.content_visible('lesson_assets',a.id) and (private.has_role('TEACHER',true) or (
  (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)) and exists (
   select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=m.course_id and e.status='ACTIVE'
  )
 ))
)));
$$;

drop policy courses_authenticated_select on public.courses;
create policy courses_authenticated_select on public.courses for select to authenticated using (private.has_role('ADMIN',true) or private.content_visible('courses',id));
drop policy modules_authenticated_select on public.modules;
create policy modules_authenticated_select on public.modules for select to authenticated using (private.has_role('ADMIN',true) or private.content_visible('modules',id));
drop policy lessons_authenticated_select on public.lessons;
create policy lessons_authenticated_select on public.lessons for select to authenticated using (private.has_role('ADMIN',true) or private.content_visible('lessons',id));
drop policy practice_activities_authenticated_select on public.practice_activities;
create policy practice_activities_authenticated_select on public.practice_activities for select to authenticated using (private.has_role('ADMIN',true) or private.content_visible('practice_activities',id));

-- Fixed allowlist. No identifier or privileged field can be supplied freely.
create function private.content_fields(p_kind text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
 case p_kind
 when 'courses' then return array['slug','title','description','active'];
 when 'modules' then return array['course_id','position','title','description'];
 when 'lessons' then return array['module_id','position','slug','title','estimated_minutes'];
 when 'lesson_assets' then return array['lesson_id','asset_type','position','source_url','content','metadata','required_entitlement_key'];
 when 'materials' then return array['title','material_type','module_id','lesson_id','external_url','metadata','active','required_entitlement_key'];
 when 'practice_activities' then return array['slug','title','skill','cefr_target','difficulty','estimated_minutes','related_module_id','related_lesson_id','content','active'];
 else raise exception 'Unsupported content entity' using errcode='22023';
 end case;
end $$;

create function private.assert_content_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.has_role('ADMIN',true) then
  raise exception 'ADMIN with AAL2 required' using errcode='42501';
 end if;
end $$;

create function private.validate_content(p_kind text,p_row jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare source text; body jsonb; parent_id uuid; lesson_parent uuid; option_count integer; answer text;
begin
 perform private.content_fields(p_kind);
 if p_kind <> 'lesson_assets' and coalesce(length(btrim(p_row->>'title')),0)=0 then
  raise exception 'Title required' using errcode='23514';
 end if;
 if p_kind in ('courses','lessons','practice_activities') and coalesce(p_row->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
  raise exception 'Valid slug required' using errcode='23514';
 end if;
 if p_kind in ('modules','lessons','lesson_assets') and coalesce((p_row->>'position')::integer,0)<1 then
  raise exception 'Positive position required' using errcode='23514';
 end if;
 if p_kind='modules' and not exists (select 1 from public.courses where id=(p_row->>'course_id')::uuid) then raise exception 'Course required' using errcode='23514'; end if;
 if p_kind='lessons' then
  if not exists (select 1 from public.modules where id=(p_row->>'module_id')::uuid) then raise exception 'Module required' using errcode='23514'; end if;
  if (p_row->>'estimated_minutes')::integer <= 0 then raise exception 'Invalid duration' using errcode='23514'; end if;
  if not exists (select 1 from public.lesson_assets where lesson_id=(p_row->>'id')::uuid and publication_status='PUBLISHED') then raise exception 'Lesson requires a published usable asset' using errcode='23514'; end if;
 end if;
 if p_kind='lesson_assets' then
  if not exists (select 1 from public.lessons where id=(p_row->>'lesson_id')::uuid) then raise exception 'Lesson required' using errcode='23514'; end if;
  if p_row->>'asset_type' not in ('VIDEO','AUDIO','TEXT','PDF','EXERCISE','LINK') then raise exception 'Unsupported asset type' using errcode='23514'; end if;
  body:=p_row->'content'; source:=nullif(p_row->>'source_url','');
  if p_row->>'asset_type'='TEXT' and (jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'title') is distinct from 'string' or jsonb_typeof(body->'body') is distinct from 'string' or coalesce(length(btrim(body->>'title')),0)=0 or coalesce(length(btrim(body->>'body')),0)=0) then raise exception 'TEXT title and body required' using errcode='23514'; end if;
  if (body is null or body='null'::jsonb or body='{}'::jsonb) and source is null and nullif(p_row->>'storage_path','') is null then raise exception 'Usable asset source required' using errcode='23514'; end if;
  if source is not null and source !~ '^https?://[^[:space:]]+$' then raise exception 'Safe source URL required' using errcode='23514'; end if;
 end if;
 if p_kind='materials' then
  if p_row->>'material_type' not in ('PDF','SUMMARY','VOCABULARY','GRAMMAR','AUDIO','WORKSHEET','ANSWER_KEY') then raise exception 'Unsupported material type' using errcode='23514'; end if;
  source:=nullif(p_row->>'external_url','');
  if source is null and nullif(p_row->>'storage_path','') is null then raise exception 'Material reference required' using errcode='23514'; end if;
  if source is not null and source !~ '^https?://[^[:space:]]+$' then raise exception 'Safe material URL required' using errcode='23514'; end if;
  if p_row->>'required_entitlement_key' is not null and (source is not null or nullif(p_row->>'storage_path','') is null) then raise exception 'Protected material requires existing private storage' using errcode='23514'; end if;
 end if;
 if p_kind in ('lesson_assets','materials') and p_row->>'required_entitlement_key' is not null and not exists (select 1 from public.entitlements where key=p_row->>'required_entitlement_key' and active) then raise exception 'Valid entitlement required' using errcode='23514'; end if;
 if p_kind in ('materials','practice_activities') then
  parent_id:=nullif(p_row->>(case when p_kind='materials' then 'module_id' else 'related_module_id' end),'')::uuid;
  lesson_parent:=nullif(p_row->>(case when p_kind='materials' then 'lesson_id' else 'related_lesson_id' end),'')::uuid;
  if parent_id is not null and not exists(select 1 from public.modules where id=parent_id) then raise exception 'Invalid module' using errcode='23514'; end if;
  if lesson_parent is not null and not exists(select 1 from public.lessons where id=lesson_parent and (parent_id is null or module_id=parent_id)) then raise exception 'Inconsistent lesson context' using errcode='23514'; end if;
 end if;
 if p_kind='practice_activities' then
  body:=p_row->'content';
  if coalesce((p_row->>'estimated_minutes')::integer,0)<1 or p_row->>'skill' not in ('SPEAKING','PRONUNCIATION','VOCABULARY','GRAMMAR') then raise exception 'Unsupported practice metadata' using errcode='23514'; end if;
  if jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'prompt') is distinct from 'string' or coalesce(length(body->>'prompt'),0) not between 1 and 600 then raise exception 'Practice prompt required' using errcode='23514'; end if;
  if body->>'kind'='MULTIPLE_CHOICE' and body->>'evaluationMode'='DETERMINISTIC' then
   if (body - array['kind','evaluationMode','prompt','options']) <> '{}'::jsonb or jsonb_typeof(body->'options') is distinct from 'array' or jsonb_array_length(body->'options') not between 2 and 6 then raise exception 'Invalid practice options' using errcode='23514'; end if;
   select count(distinct o->>'id') into option_count from jsonb_array_elements(body->'options') o;
   if option_count <> jsonb_array_length(body->'options') or exists(select 1 from jsonb_array_elements(body->'options') o where jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'label') is distinct from 'string' or (o-array['id','label']) <> '{}'::jsonb or coalesce(length(o->>'id'),0) not between 1 and 80 or coalesce(length(o->>'label'),0) not between 1 and 240) then raise exception 'Invalid practice option' using errcode='23514'; end if;
   select answer_key->>'optionId' into answer from private.practice_answer_keys where practice_activity_id=(p_row->>'id')::uuid;
   if answer is null or not exists(select 1 from jsonb_array_elements(body->'options') o where o->>'id'=answer) then raise exception 'Matching private answer key required' using errcode='23514'; end if;
  elsif body->>'kind'='MANUAL_TEXT' and body->>'evaluationMode'='MANUAL_PENDING' then
   if jsonb_typeof(body->'instructions') is distinct from 'string' or (body-array['kind','evaluationMode','prompt','instructions']) <> '{}'::jsonb or coalesce(length(body->>'instructions'),0) not between 1 and 600 then raise exception 'Manual instructions required' using errcode='23514'; end if;
  else raise exception 'Unsupported practice content' using errcode='23514'; end if;
 end if;
end $$;

-- Backfill valid existing rows only. Child assets precede lesson validation.
do $$
declare t text; r record;
begin
 foreach t in array array['courses','modules','lesson_assets','lessons','materials','practice_activities'] loop
  for r in execute format('select id,to_jsonb(x) data from public.%I x',t) loop
   begin
    perform private.validate_content(t,r.data);
    execute format('update public.%I set publication_status=''PUBLISHED'', published_at=now() where id=$1',t) using r.id;
   exception when check_violation then
    raise notice 'Legacy % % remains DRAFT: invalid structural content',t,r.id;
   end;
  end loop;
 end loop;
end $$;

create function private.content_change_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and old.publication_status='PUBLISHED' and
  (to_jsonb(new)-array['publication_status','published_at','updated_at','position']) is distinct from
  (to_jsonb(old)-array['publication_status','published_at','updated_at','position']) then
  raise exception 'Unpublish before editing content' using errcode='23514';
 end if;
 if new.publication_status='PUBLISHED' then perform private.validate_content(tg_table_name,to_jsonb(new)); end if;
 if tg_table_name='lesson_assets' and tg_op='UPDATE' then
  if old.publication_status='PUBLISHED' and new.publication_status='DRAFT'
   and exists(select 1 from public.lessons where id=old.lesson_id and publication_status='PUBLISHED')
   and not exists(select 1 from public.lesson_assets where lesson_id=old.lesson_id and id<>old.id and publication_status='PUBLISHED') then
   raise exception 'Unpublish the lesson before its last usable asset' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create function public.admin_content_list(p_kind text)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform private.assert_content_admin(); perform private.content_fields(p_kind);
 return query execute format('select (to_jsonb(x)-''storage_path'') || jsonb_build_object(''has_storage_reference'', nullif(to_jsonb(x)->>''storage_path'','''') is not null) || case when $1=''practice_activities'' then jsonb_build_object(''answer_key'',(select answer_key from private.practice_answer_keys where practice_activity_id=x.id)) else ''{}''::jsonb end from public.%I x order by %s id',p_kind,case when p_kind in ('modules','lessons','lesson_assets') then 'position,' when p_kind='practice_activities' then 'estimated_minutes,slug,' when p_kind='courses' then 'slug,' else 'created_at,' end) using p_kind;
end $$;

create function public.admin_content_save(p_kind text,p_id uuid,p_data jsonb,p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare allowed text[]; fields text; values_sql text; assignments text; existing jsonb; row_id uuid:=coalesce(p_id,gen_random_uuid()); k text; clean jsonb; answer jsonb;
begin
 perform private.assert_content_admin(); allowed:=private.content_fields(p_kind);
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Object required' using errcode='22023'; end if;
 if p_kind='practice_activities' then answer:=p_data->'answer_key'; clean:=p_data-'answer_key'; else clean:=p_data; end if;
 for k in select jsonb_object_keys(clean) loop
  if not (k=any(allowed)) then raise exception 'Unsupported content field' using errcode='22023'; end if;
 end loop;
 -- Serialize all writes/reorders of this entity to avoid unique-position races.
 perform pg_advisory_xact_lock(hashtext('admin-content'));
 if p_id is not null then
  execute format('select to_jsonb(x) from public.%I x where id=$1 for update',p_kind) into existing using p_id;
  if existing is null then raise exception 'Content unavailable' using errcode='42501'; end if;
  if existing->>'publication_status' <> 'DRAFT' then raise exception 'Unpublish before editing content' using errcode='23514'; end if;
 end if;
 -- Never accept/return private storage paths. Existing storage references remain intact.
 select string_agg(format('%I',key),','),string_agg(format('r.%I',key),','),string_agg(format('%I=r.%I',key,key),',') into fields,values_sql,assignments from jsonb_object_keys(clean) key;
 if fields is null then raise exception 'Content fields required' using errcode='22023'; end if;
 if clean ? 'title' then clean:=jsonb_set(clean,'{title}',to_jsonb(btrim(clean->>'title'))); end if;
 if clean ? 'slug' then clean:=jsonb_set(clean,'{slug}',to_jsonb(lower(btrim(clean->>'slug')))); end if;
 if p_id is null then
  execute format('insert into public.%I (id,%s) select $1,%s from jsonb_populate_record(null::public.%I,$2) r',p_kind,fields,values_sql,p_kind) using row_id,clean;
 else
  execute format('update public.%I x set %s,updated_at=now() from jsonb_populate_record(null::public.%I,$2) r where x.id=$1',p_kind,assignments,p_kind) using row_id,clean;
 end if;
 if answer is not null then
  if jsonb_typeof(answer) is distinct from 'object' or (answer-'optionId') <> '{}'::jsonb or coalesce(length(answer->>'optionId'),0)=0 then raise exception 'Invalid answer key' using errcode='23514'; end if;
  insert into private.practice_answer_keys(practice_activity_id,answer_key) values(row_id,answer)
   on conflict(practice_activity_id) do update set answer_key=excluded.answer_key;
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
 values(auth.uid(),case when p_id is null then 'content_created' else 'content_updated' end,p_kind,row_id,jsonb_build_object('changed_fields',(select jsonb_agg(key) from jsonb_object_keys(clean) key)),coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),left(coalesce(p_context->>'environment','unknown'),40),left(coalesce(p_context->>'version','unknown'),120));
 return row_id;
end $$;

create function public.admin_content_transition(p_kind text,p_id uuid,p_status text,p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare existing jsonb;
begin
 perform private.assert_content_admin(); perform private.content_fields(p_kind);
 if p_status is null or p_status not in ('DRAFT','PUBLISHED') then raise exception 'Invalid publication state' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('admin-content'));
 execute format('select to_jsonb(x) from public.%I x where id=$1 for update',p_kind) into existing using p_id;
 if existing is null then raise exception 'Content unavailable' using errcode='42501'; end if;
 if existing->>'publication_status'=p_status then raise exception 'Invalid publication transition' using errcode='23514'; end if;
 if p_status='PUBLISHED' then perform private.validate_content(p_kind,existing); end if;
 execute format('update public.%I set publication_status=$2,published_at=case when $2=''PUBLISHED'' then now() else null end,updated_at=now() where id=$1',p_kind) using p_id,p_status;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
 values(auth.uid(),case when p_status='PUBLISHED' then 'content_published' else 'content_unpublished' end,p_kind,p_id,jsonb_build_object('previous_status',existing->>'publication_status','new_status',p_status),coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),left(coalesce(p_context->>'environment','unknown'),40),left(coalesce(p_context->>'version','unknown'),120));
end $$;

-- Defer the existing parent-position uniqueness only within an atomic permutation.
alter table public.modules drop constraint modules_course_id_position_key, add constraint modules_course_id_position_key unique(course_id,position) deferrable initially immediate;
alter table public.lessons drop constraint lessons_module_id_position_key, add constraint lessons_module_id_position_key unique(module_id,position) deferrable initially immediate;
alter table public.lesson_assets drop constraint lesson_assets_lesson_id_position_key, add constraint lesson_assets_lesson_id_position_key unique(lesson_id,position) deferrable initially immediate;
create function public.admin_content_reorder(p_kind text,p_parent_id uuid,p_ids uuid[],p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare parent_col text; actual uuid[]; previous jsonb;
begin
 perform private.assert_content_admin();
 parent_col:=case p_kind when 'modules' then 'course_id' when 'lessons' then 'module_id' when 'lesson_assets' then 'lesson_id' else null end;
 if parent_col is null or p_parent_id is null or coalesce(cardinality(p_ids),0)=0 then raise exception 'Positioned parent required' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('admin-content'));
 execute format('select array_agg(id order by id),jsonb_agg(jsonb_build_object(''id'',id,''position'',position) order by position) from public.%I where %I=$1',p_kind,parent_col) into actual,previous using p_parent_id;
 if actual is null or actual is distinct from (select array_agg(id order by id) from unnest(p_ids) id) or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'Reorder requires exactly the same parent members' using errcode='23514'; end if;
 set constraints public.modules_course_id_position_key,public.lessons_module_id_position_key,public.lesson_assets_lesson_id_position_key deferred;
 execute format('update public.%I x set position=y.position,updated_at=now() from (select id,ordinality::integer position from unnest($1::uuid[]) with ordinality as ids(id,ordinality)) y where x.id=y.id',p_kind) using p_ids;
 set constraints public.modules_course_id_position_key,public.lessons_module_id_position_key,public.lesson_assets_lesson_id_position_key immediate;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version) values(auth.uid(),'content_reordered',p_kind,p_parent_id,jsonb_build_object('parent_id',p_parent_id,'previous_positions',previous,'new_order',to_jsonb(p_ids)),coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),left(coalesce(p_context->>'environment','unknown'),40),left(coalesce(p_context->>'version','unknown'),120));
end $$;

do $$
declare t text; f record;
begin
 foreach t in array array['courses','modules','lessons','lesson_assets','materials','practice_activities'] loop
  execute format('create trigger content_publication_guard before insert or update on public.%I for each row execute function private.content_change_guard()',t);
  execute format('revoke insert, update, delete on public.%I from public, anon, authenticated',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname in ('content_visible','content_fields','assert_content_admin','validate_content','content_change_guard')) or (n.nspname='public' and p.proname in ('admin_content_list','admin_content_save','admin_content_transition','admin_content_reorder')) loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
grant execute on function private.content_visible(text,uuid) to authenticated;
grant execute on function public.admin_content_list(text), public.admin_content_save(text,uuid,jsonb,jsonb), public.admin_content_transition(text,uuid,text,jsonb), public.admin_content_reorder(text,uuid,uuid[],jsonb) to authenticated;

-- Preserve existing RPC contracts, enforce published ancestry durably.
create or replace function public.track_product_event(
  p_event_name text,
  p_lesson_id uuid default null,
  p_properties jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  analytics_module_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_name not in (
    'signup_completed',
    'login_completed',
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'lesson_started',
    'lesson_progressed',
    'lesson_completed',
    'module_completed',
    'practice_started',
    'practice_completed',
    'material_opened',
    'material_favorited',
    'assessment_started',
    'assessment_completed',
    'live_session_booked',
    'live_session_cancelled',
    'live_session_attended'
  ) then
    raise exception 'Unsupported product analytics event';
  end if;

  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Analytics properties must be an object';
  end if;

  if p_idempotency_key is not null
    and char_length(p_idempotency_key) not between 1 and 160 then
    raise exception 'Analytics idempotency key must contain 1 to 160 characters';
  end if;

  if p_event_name in ('lesson_started', 'lesson_completed', 'module_completed')
    and p_idempotency_key is null then
    raise exception 'Critical learning analytics require an idempotency key';
  end if;

  if p_event_name in ('lesson_started', 'lesson_progressed', 'lesson_completed') then
    if p_lesson_id is null or not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      join public.modules m on m.course_id = c.id
      join public.lessons l on l.module_id = m.id
      where e.user_id = actor_user_id
        and e.status = 'ACTIVE'
        and c.active
        and private.content_visible('modules',m.id)
        and l.id = p_lesson_id
        and private.content_visible('lessons',l.id)
    ) then
      raise exception 'Active enrollment in a published lesson required'
        using errcode = '42501';
    end if;
  end if;

  if p_event_name = 'lesson_completed' and not exists (
    select 1
    from public.lesson_progress lp
    where lp.user_id = actor_user_id
      and lp.lesson_id = p_lesson_id
      and lp.completion_percent = 100
  ) then
    raise exception 'Completed lesson progress required' using errcode = '42501';
  end if;

  if p_event_name = 'module_completed' then
    begin
      analytics_module_id := nullif(p_properties ->> 'module_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Valid module_id property required';
    end;

    if analytics_module_id is null or not exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where m.id = analytics_module_id
        and e.user_id = actor_user_id
        and e.status = 'ACTIVE'
        and c.active
        and private.content_visible('modules',m.id)
        and exists (
          select 1
          from public.lessons l
          where l.module_id = m.id
            and private.content_visible('lessons',l.id)
        )
        and not exists (
          select 1
          from public.lessons l
          left join public.lesson_progress lp
            on lp.lesson_id = l.id
            and lp.user_id = actor_user_id
          where l.module_id = m.id
            and private.content_visible('lessons',l.id)
            and coalesce(lp.completion_percent, 0) < 100
        )
    ) then
      raise exception 'Completed enrolled module required' using errcode = '42501';
    end if;
  end if;

  insert into public.product_analytics_events (
    user_id,
    event_name,
    lesson_id,
    properties,
    idempotency_key
  )
  values (
    actor_user_id,
    p_event_name,
    p_lesson_id,
    coalesce(p_properties, '{}'::jsonb),
    p_idempotency_key
  )
  on conflict (user_id, idempotency_key)
    where idempotency_key is not null
    do nothing;
end;
$$;

revoke all on function public.track_product_event(text, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.track_product_event(text, uuid, jsonb, text)
  to authenticated;

create or replace function public.record_lesson_progress(
  p_lesson_id uuid,
  p_completion_percent numeric,
  p_last_position_seconds integer default null
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  enrollment_id uuid;
  result_row public.lesson_progress;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception 'completion_percent must be between 0 and 100';
  end if;

  if p_last_position_seconds is not null and p_last_position_seconds < 0 then
    raise exception 'last_position_seconds must be non-negative';
  end if;

  select e.id
  into enrollment_id
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  join public.courses c on c.id = e.course_id
  where e.user_id = actor_user_id
    and e.status = 'ACTIVE'
    and c.active
        and private.content_visible('modules',m.id)
    and l.id = p_lesson_id
        and private.content_visible('lessons',l.id)
  order by e.enrolled_at desc, e.id
  limit 1;

  if enrollment_id is null then
    raise exception 'Active enrollment in a published course required' using errcode = '42501';
  end if;

  insert into public.lesson_progress (
    enrollment_id,
    lesson_id,
    user_id,
    status,
    completion_percent,
    last_position_seconds,
    started_at,
    last_accessed_at,
    completed_at,
    updated_at
  )
  values (
    enrollment_id,
    p_lesson_id,
    actor_user_id,
    case
      when p_completion_percent >= 100 then 'COMPLETED'
      when p_completion_percent > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    p_completion_percent,
    p_last_position_seconds,
    case when p_completion_percent > 0 then now() else null end,
    now(),
    case when p_completion_percent >= 100 then now() else null end,
    now()
  )
  on conflict (user_id, lesson_id)
  do update set
    completion_percent = greatest(
      public.lesson_progress.completion_percent,
      excluded.completion_percent
    ),
    status = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100 then 'COMPLETED'
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    last_position_seconds = case
      when excluded.last_position_seconds is null
        then public.lesson_progress.last_position_seconds
      when public.lesson_progress.last_position_seconds is null
        then excluded.last_position_seconds
      else greatest(
        public.lesson_progress.last_position_seconds,
        excluded.last_position_seconds
      )
    end,
    started_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0
        then coalesce(public.lesson_progress.started_at, now())
      else public.lesson_progress.started_at
    end,
    last_accessed_at = now(),
    completed_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100
        then coalesce(public.lesson_progress.completed_at, now())
      else public.lesson_progress.completed_at
    end,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.record_lesson_progress(uuid, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.record_lesson_progress(uuid, numeric, integer)
  to authenticated;

create or replace function public.start_practice_attempt(
  p_practice_activity_id uuid,
  p_idempotency_key uuid
)
returns public.practice_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  activity_mode text;
  result_row public.practice_attempts;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'Practice idempotency key is required';
  end if;

  select activity.content ->> 'evaluationMode'
  into activity_mode
  from public.practice_activities activity
  where activity.id = p_practice_activity_id
    and activity.active
    and private.content_visible('practice_activities',activity.id);

  if activity_mode is null or activity_mode not in ('DETERMINISTIC', 'MANUAL_PENDING') then
    raise exception 'Practice activity is unsupported';
  end if;

  insert into public.practice_attempts (
    user_id,
    practice_activity_id,
    idempotency_key,
    context
  )
  values (
    actor_user_id,
    p_practice_activity_id,
    p_idempotency_key,
    jsonb_build_object('evaluation_mode', activity_mode)
  )
  on conflict (user_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into result_row;

  if result_row.practice_activity_id <> p_practice_activity_id then
    raise exception 'Idempotency key already belongs to another activity';
  end if;

  return result_row;
end;
$$;

revoke all on function public.start_practice_attempt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.start_practice_attempt(uuid, uuid)
  to authenticated;

create or replace function public.submit_practice_attempt(
  p_practice_attempt_id uuid,
  p_response jsonb
)
returns public.practice_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  attempt_row public.practice_attempts;
  activity_row public.practice_activities;
  answer_row private.practice_answer_keys;
  result_row public.practice_results;
  evaluation_mode text;
  submitted_option_id text;
  expected_option_id text;
  response_text text;
  is_correct boolean;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_response, 'null'::jsonb)) <> 'object' then
    raise exception 'Practice response must be an object';
  end if;

  select *
  into attempt_row
  from public.practice_attempts attempt
  where attempt.id = p_practice_attempt_id
    and attempt.user_id = actor_user_id
  for update;

  if attempt_row.id is null then
    raise exception 'Practice attempt not found' using errcode = '42501';
  end if;

  if not private.content_visible('practice_activities',attempt_row.practice_activity_id) then
    raise exception 'Practice activity is unavailable' using errcode='42501';
  end if;

  if attempt_row.status = 'SUBMITTED' then
    select * into result_row
    from public.practice_results result
    where result.practice_attempt_id = attempt_row.id;

    if result_row.id is null then
      raise exception 'Submitted practice attempt has no result';
    end if;

    return result_row;
  end if;

  if attempt_row.status <> 'IN_PROGRESS' then
    raise exception 'Practice attempt cannot be submitted';
  end if;

  select *
  into activity_row
  from public.practice_activities activity
  where activity.id = attempt_row.practice_activity_id
    and activity.active
    and private.content_visible('practice_activities',activity.id);

  if activity_row.id is null then
    raise exception 'Practice activity is unavailable';
  end if;

  evaluation_mode := activity_row.content ->> 'evaluationMode';

  if evaluation_mode = 'DETERMINISTIC' then
    submitted_option_id := nullif(btrim(p_response ->> 'optionId'), '');

    if submitted_option_id is null or not exists (
      select 1
      from jsonb_array_elements(activity_row.content -> 'options') option
      where option ->> 'id' = submitted_option_id
    ) then
      raise exception 'A valid practice option is required';
    end if;

    select *
    into answer_row
    from private.practice_answer_keys answer_key
    where answer_key.practice_activity_id = activity_row.id;

    expected_option_id := answer_row.answer_key ->> 'optionId';
    if expected_option_id is null then
      raise exception 'Deterministic activity has no answer key';
    end if;

    is_correct := submitted_option_id = expected_option_id;

    insert into public.practice_responses (practice_attempt_id, response)
    values (attempt_row.id, jsonb_build_object('optionId', submitted_option_id));

    insert into public.practice_results (
      practice_attempt_id,
      score,
      max_score,
      feedback,
      metrics,
      evaluation_status
    )
    values (
      attempt_row.id,
      case when is_correct then 1 else 0 end,
      1,
      case
        when is_correct then coalesce(
          answer_row.feedback ->> 'correct',
          'Resposta correta.'
        )
        else coalesce(
          answer_row.feedback ->> 'incorrect',
          'Resposta incorreta. Revise a explicação e tente outra atividade.'
        )
      end,
      jsonb_build_object(
        'evaluation_mode', 'DETERMINISTIC',
        'correct', is_correct
      ),
      case when is_correct then 'CORRECT' else 'INCORRECT' end
    )
    returning * into result_row;
  elsif evaluation_mode = 'MANUAL_PENDING' then
    response_text := nullif(btrim(p_response ->> 'text'), '');

    if response_text is null or char_length(response_text) > 2000 then
      raise exception 'Manual response must contain 1 to 2000 characters';
    end if;

    insert into public.practice_responses (practice_attempt_id, response)
    values (attempt_row.id, jsonb_build_object('text', response_text));

    insert into public.practice_results (
      practice_attempt_id,
      score,
      max_score,
      feedback,
      metrics,
      evaluation_status
    )
    values (
      attempt_row.id,
      null,
      null,
      'Resposta registrada. A política de avaliação permanece pendente; nenhum score foi inferido.',
      jsonb_build_object('evaluation_mode', 'MANUAL_PENDING'),
      'PENDING_MANUAL'
    )
    returning * into result_row;
  else
    raise exception 'Practice activity evaluation mode is unsupported';
  end if;

  update public.practice_attempts
  set status = 'SUBMITTED', submitted_at = now()
  where id = attempt_row.id;

  return result_row;
end;
$$;

revoke all on function public.submit_practice_attempt(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_practice_attempt(uuid, jsonb)
  to authenticated;
