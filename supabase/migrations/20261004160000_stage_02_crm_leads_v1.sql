create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  email text,
  phone text,
  source text not null check (char_length(btrim(source)) between 1 and 80),
  stage text not null default 'NEW' check (stage in ('NEW','CONTACTED','QUALIFIED','WON','LOST')),
  temperature text not null default 'COLD' check (temperature in ('COLD','WARM','HOT')),
  estimated_value numeric(12,2) check (estimated_value is null or estimated_value >= 0),
  owner_user_id uuid references auth.users(id) on delete set null,
  linked_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null),
  check (email is null or (char_length(email) <= 254 and email = lower(btrim(email)))),
  check (phone is null or char_length(phone) between 7 and 32)
);
create index crm_leads_stage_updated_idx on public.crm_leads(stage,updated_at desc,id);
create index crm_leads_owner_idx on public.crm_leads(owner_user_id,stage,updated_at desc);
create unique index crm_leads_linked_user_unique on public.crm_leads(linked_user_id) where linked_user_id is not null;
create trigger crm_leads_updated before update on public.crm_leads for each row execute function private.set_updated_at();

create table public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('NOTE','CALL','MEETING','EMAIL')),
  summary text not null check (char_length(btrim(summary)) between 1 and 4000),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index crm_interactions_lead_idx on public.crm_interactions(lead_id,occurred_at desc,id);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  due_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status='OPEN' and completed_at is null) or (status='COMPLETED' and completed_at is not null))
);
create index crm_tasks_lead_due_idx on public.crm_tasks(lead_id,status,due_at,id);
create index crm_tasks_open_due_idx on public.crm_tasks(status,due_at) where status='OPEN';

alter table public.crm_leads enable row level security;
alter table public.crm_interactions enable row level security;
alter table public.crm_tasks enable row level security;
revoke all on public.crm_leads, public.crm_interactions, public.crm_tasks from anon, authenticated;

create function public.admin_crm_directory(p_query text default null,p_stage text default null,p_limit integer default 25,p_offset integer default 0)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN AAL2 required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 10000
    or char_length(coalesce(p_query,''))>120 or (p_stage is not null and p_stage not in ('NEW','CONTACTED','QUALIFIED','WON','LOST')) then
    raise exception 'invalid CRM directory bounds' using errcode='22023';
  end if;
  return query select jsonb_build_object(
    'id',l.id,'name',l.name,'email',l.email,'phone',l.phone,'source',l.source,'stage',l.stage,
    'temperature',l.temperature,'estimated_value',l.estimated_value,'owner_user_id',l.owner_user_id,
    'owner_name',owner_profile.display_name,'linked_user_id',l.linked_user_id,
    'created_at',l.created_at,'updated_at',l.updated_at,
    'next_task',task.next_task,'overdue',task.overdue,
    'tasks',task.tasks,'interactions',interactions.items)
  from public.crm_leads l
  left join public.profiles owner_profile on owner_profile.user_id=l.owner_user_id
  left join lateral (
    select (select jsonb_build_object('id',t.id,'title',t.title,'due_at',t.due_at,'owner_user_id',t.owner_user_id)
      from public.crm_tasks t where t.lead_id=l.id and t.status='OPEN'
      order by t.due_at nulls last,t.id limit 1) as next_task,
      exists(select 1 from public.crm_tasks t where t.lead_id=l.id and t.status='OPEN' and t.due_at<now()) as overdue,
      coalesce((select jsonb_agg(jsonb_build_object('id',bounded.id,'title',bounded.title,'due_at',bounded.due_at,
        'owner_user_id',bounded.owner_user_id,'status',bounded.status,'completed_at',bounded.completed_at)
        order by bounded.due_at nulls last,bounded.id) from (select t.* from public.crm_tasks t where t.lead_id=l.id
        order by t.created_at desc,t.id limit 20) bounded),'[]'::jsonb) as tasks
  ) task on true
  left join lateral (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'type',i.interaction_type,
    'summary',i.summary,'actor_user_id',i.actor_user_id,'occurred_at',i.occurred_at)
    order by i.occurred_at desc,i.id),'[]'::jsonb) as items
    from (select * from public.crm_interactions i where i.lead_id=l.id order by i.occurred_at desc,i.id limit 20) i) interactions on true
  where (p_stage is null or l.stage=p_stage)
    and (p_query is null or l.name ilike '%'||replace(replace(replace(p_query,'!','!!'),'%','!%'),'_','!_')||'%' escape '!'
      or coalesce(l.email,'') ilike '%'||replace(replace(replace(p_query,'!','!!'),'%','!%'),'_','!_')||'%' escape '!'
      or coalesce(l.phone,'') ilike '%'||replace(replace(replace(p_query,'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
  order by l.updated_at desc,l.id limit p_limit offset p_offset;
end $$;

create function public.admin_crm_mutate(p_operation text,p_lead_id uuid,p_input jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=p_lead_id; lead_row public.crm_leads; owner_id uuid; linked_id uuid; next_stage text;
begin
  if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN AAL2 required' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_input,'{}'::jsonb))<>'object' then raise exception 'object input required' using errcode='22023'; end if;
  if p_operation='CREATE' then
    if p_input ?| array['owner_user_id','linked_user_id','stage','created_at','id'] then raise exception 'server-owned fields are not accepted' using errcode='22023'; end if;
    insert into public.crm_leads(name,email,phone,source,temperature,estimated_value)
    values(btrim(p_input->>'name'),nullif(lower(btrim(p_input->>'email')),''),nullif(btrim(p_input->>'phone'),''),
      btrim(p_input->>'source'),coalesce(p_input->>'temperature','COLD'),nullif(p_input->>'estimated_value','')::numeric)
    returning id into target;
    update public.crm_leads set owner_user_id=auth.uid() where id=target;
  elsif p_operation='UPDATE' then
    select * into lead_row from public.crm_leads where id=p_lead_id for update;
    if lead_row.id is null then raise exception 'lead not found' using errcode='P0002'; end if;
    if p_input ? 'owner_user_id' then
      owner_id:=nullif(p_input->>'owner_user_id','')::uuid;
      if owner_id is not null and not exists(select 1 from public.user_roles where user_id=owner_id and role in ('ADMIN','SUPPORT')) then raise exception 'authorized staff owner required' using errcode='42501'; end if;
    else owner_id:=lead_row.owner_user_id; end if;
    update public.crm_leads set name=coalesce(nullif(btrim(p_input->>'name'),''),name),
      email=case when p_input ? 'email' then nullif(lower(btrim(p_input->>'email')),'') else email end,
      phone=case when p_input ? 'phone' then nullif(btrim(p_input->>'phone'),'') else phone end,
      source=coalesce(nullif(btrim(p_input->>'source'),''),source),
      temperature=coalesce(p_input->>'temperature',temperature),
      estimated_value=case when p_input ? 'estimated_value' then nullif(p_input->>'estimated_value','')::numeric else estimated_value end,
      owner_user_id=owner_id where id=p_lead_id;
  elsif p_operation='STAGE' then
    select * into lead_row from public.crm_leads where id=p_lead_id for update;
    next_stage:=p_input->>'stage';
    if lead_row.id is null or next_stage not in ('CONTACTED','QUALIFIED','WON','LOST')
      or not ((lead_row.stage='NEW' and next_stage in ('CONTACTED','LOST'))
        or (lead_row.stage='CONTACTED' and next_stage in ('QUALIFIED','LOST'))
        or (lead_row.stage='QUALIFIED' and next_stage in ('WON','LOST'))) then
      raise exception 'invalid CRM stage transition' using errcode='23514';
    end if;
    update public.crm_leads set stage=next_stage where id=p_lead_id;
  elsif p_operation='LINK_USER' then
    linked_id:=nullif(p_input->>'user_id','')::uuid;
    if linked_id is null or not exists(select 1 from public.user_roles where user_id=linked_id and role='STUDENT') then raise exception 'existing Student identity required' using errcode='23514'; end if;
    update public.crm_leads set linked_user_id=linked_id where id=p_lead_id and linked_user_id is null returning id into target;
    if target is null then raise exception 'lead already linked or missing' using errcode='23514'; end if;
  elsif p_operation='INTERACTION' then
    insert into public.crm_interactions(lead_id,interaction_type,summary,actor_user_id)
      values(p_lead_id,p_input->>'type',btrim(p_input->>'summary'),auth.uid()) returning lead_id into target;
  elsif p_operation='TASK' then
    owner_id:=nullif(p_input->>'owner_user_id','')::uuid;
    if owner_id is not null and not exists(select 1 from public.user_roles where user_id=owner_id and role in ('ADMIN','SUPPORT')) then raise exception 'authorized staff task owner required' using errcode='42501'; end if;
    insert into public.crm_tasks(lead_id,title,due_at,owner_user_id)
      values(p_lead_id,btrim(p_input->>'title'),nullif(p_input->>'due_at','')::timestamptz,owner_id) returning lead_id into target;
  elsif p_operation='COMPLETE_TASK' then
    update public.crm_tasks set status='COMPLETED',completed_at=now()
      where id=p_lead_id and status='OPEN' returning lead_id into target;
    if target is null then raise exception 'open task required' using errcode='23514'; end if;
  else raise exception 'invalid CRM operation' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data)
    values(auth.uid(),'CRM_'||p_operation,'crm_leads',target,jsonb_build_object('lead_id',case when p_operation='COMPLETE_TASK' then target else p_lead_id end));
  return target;
end $$;

revoke all on function public.admin_crm_directory(text,text,integer,integer),public.admin_crm_mutate(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_crm_directory(text,text,integer,integer),public.admin_crm_mutate(text,uuid,jsonb) to authenticated;
