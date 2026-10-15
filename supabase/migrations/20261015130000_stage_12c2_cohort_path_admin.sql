-- ADR 0022 / C2. Actor-bound RPCs; raw path tables stay inaccessible to authenticated clients.
-- A catalog contains metadata only: never content, answer keys, storage paths or signed URLs.
create function private.cohort_path_catalog(p_course uuid)
returns table(content_kind text,content_id uuid,title text,audience text,parent_kind text,parent_id uuid,
  publication_status text,slug text,estimated_minutes integer,description text,default_included boolean,
  course_position bigint)
language sql stable security definer set search_path = '' as $$
  with items as (
    select 'modules'::text kind,m.id,m.title,m.audience,null::text parent_kind,null::uuid parent_id,
      m.publication_status,null::text slug,null::integer estimated_minutes,m.description,
      m.audience='COURSE' standard,m.position mp,m.id mid,-1 lp,null::uuid lid,0 rank
      from public.modules m where m.course_id=p_course
    union all
    select 'lessons',l.id,l.title,l.audience,'modules',l.module_id,l.publication_status,l.slug,l.estimated_minutes,
      null,l.audience='COURSE' and m.audience='COURSE',m.position,m.id,l.position,l.id,1
      from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=p_course
    union all
    select 'materials',a.id,a.title,a.audience,
      case when a.lesson_id is not null then 'lessons' else 'modules' end,coalesce(a.lesson_id,a.module_id),
      a.publication_status,null,null,null,
      a.audience='COURSE' and m.audience='COURSE' and (l.id is null or l.audience='COURSE'),
      m.position,m.id,coalesce(l.position,-1),l.id,2
      from public.materials a left join public.lessons l on l.id=a.lesson_id
      join public.modules m on m.id=coalesce(l.module_id,a.module_id) where m.course_id=p_course
    union all
    select 'practice_activities',a.id,a.title,a.audience,
      case when a.related_lesson_id is not null then 'lessons' when a.related_module_id is not null then 'modules' end,
      coalesce(a.related_lesson_id,a.related_module_id),a.publication_status,a.slug,a.estimated_minutes,null,
      a.audience='COURSE' and (m.id is null or m.audience='COURSE') and (l.id is null or l.audience='COURSE'),
      m.position,m.id,coalesce(l.position,-1),l.id,3
      from public.practice_activities a left join public.lessons l on l.id=a.related_lesson_id
      left join public.modules m on m.id=coalesce(l.module_id,a.related_module_id)
      where coalesce(a.course_id,m.course_id)=p_course and a.audience<>'ASSIGNED'
  )
  select kind,id,title,audience,parent_kind,parent_id,publication_status,slug,estimated_minutes,description,
    standard,row_number() over(order by mp nulls last,mid nulls last,lp,lid nulls first,rank,id)-1
  from items;
$$;

create function public.admin_cohort_path_get(p_cohort_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cohort public.cohorts; result jsonb;
begin
  perform private.assert_content_admin();
  select * into cohort from public.cohorts where id=p_cohort_id;
  if not found then raise exception 'Cohort unavailable' using errcode='P0002'; end if;
  select jsonb_build_object('cohortId',cohort.id,'courseId',cohort.course_id,'cohortName',cohort.name,
    'mode',coalesce(cp.mode,'DEFAULT'),'sequential',coalesce(cp.sequential,false),'updatedAt',cp.updated_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object('contentKind',i.content_kind,'contentId',i.content_id,
      'position',i.position,'availableFrom',i.available_from) order by i.position,i.content_kind,i.content_id)
      from public.cohort_path_items i where i.cohort_id=cohort.id),'[]'::jsonb),
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('contentKind',c.content_kind,'contentId',c.content_id,
      'title',c.title,'audience',c.audience,'parentKind',c.parent_kind,'parentId',c.parent_id,
      'publicationStatus',c.publication_status,'coursePosition',c.course_position,'defaultIncluded',c.default_included)
      order by c.course_position) from private.cohort_path_catalog(cohort.course_id) c),'[]'::jsonb))
    into result from (select 1) singleton left join public.cohort_paths cp on cp.cohort_id=cohort.id;
  return result;
end;
$$;

create function public.admin_cohort_path_save(p_cohort_id uuid,p_mode text,p_sequential boolean,
  p_items jsonb default '[]'::jsonb,p_copy_from_course boolean default false,p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cohort public.cohorts; items jsonb := p_items; item jsonb; info record; enrollment record;
  item_id uuid; item_position integer; release_at timestamptz; before_state jsonb;
begin
  perform private.assert_content_admin();
  if p_mode is null or p_mode not in ('DEFAULT','CUSTOM') or p_sequential is null or p_copy_from_course is null
    or jsonb_typeof(items) is distinct from 'array' or jsonb_typeof(p_context) is distinct from 'object' then
    raise exception 'Invalid path settings' using errcode='23514';
  end if;
  if jsonb_array_length(items)>2000 then raise exception 'Path item limit exceeded' using errcode='23514'; end if;
  if p_copy_from_course and (p_mode<>'CUSTOM' or items<>'[]'::jsonb) then
    raise exception 'Copy requires CUSTOM mode and an empty item list' using errcode='23514';
  end if;
  -- The cohort exists before its optional path row: lock it even on the very first save.
  select * into cohort from public.cohorts where id=p_cohort_id for update;
  if not found then raise exception 'Cohort unavailable' using errcode='P0002'; end if;
  if cohort.status='ARCHIVED' then raise exception 'Archived cohort is read-only' using errcode='23514'; end if;
  before_state := public.admin_cohort_path_get(p_cohort_id) - 'catalog';
  if p_copy_from_course then
    select coalesce(jsonb_agg(jsonb_build_object('contentKind',c.content_kind,'contentId',c.content_id,
      'position',c.course_position,'availableFrom',null) order by c.course_position),'[]'::jsonb) into items
      from private.cohort_path_catalog(cohort.course_id) c
      where c.default_included and private.content_visible(c.content_kind,c.content_id);
  end if;
  if jsonb_array_length(items)>2000 then raise exception 'Path item limit exceeded' using errcode='23514'; end if;
  -- Validate the entire replacement before mutation, including deferred integrity constraints.
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) is distinct from 'object'
      or (item-array['contentKind','contentId','position','availableFrom'])<>'{}'::jsonb
      or jsonb_typeof(item->'contentKind') is distinct from 'string'
      or jsonb_typeof(item->'contentId') is distinct from 'string'
      or item->>'contentId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'position') is distinct from 'number'
      or item->>'contentKind' not in ('modules','lessons','materials','practice_activities')
      or item->>'position' !~ '^(0|[1-9][0-9]*)$'
      or (item ? 'availableFrom' and jsonb_typeof(item->'availableFrom') not in ('null','string')) then
      raise exception 'Invalid path item' using errcode='23514';
    end if;
    begin
      item_id := (item->>'contentId')::uuid;
      item_position := (item->>'position')::integer;
      release_at := (item->>'availableFrom')::timestamptz;
    exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid path item value' using errcode='23514';
    end;
    if release_at is not null and not isfinite(release_at) then
      raise exception 'Finite release timestamp required' using errcode='23514';
    end if;
    -- Polymorphic references have no FK lock. Hold source rows against concurrent moves/deletes
    -- until their path references exist, so the C1 source guard can observe those references.
    case item->>'contentKind'
      when 'modules' then perform 1 from public.modules where id=item_id for share;
      when 'lessons' then perform 1 from public.lessons where id=item_id for share;
      when 'materials' then perform 1 from public.materials where id=item_id for share;
      when 'practice_activities' then perform 1 from public.practice_activities where id=item_id for share;
    end case;
    select * into info from private.path_content_info(item->>'contentKind',item_id);
    if not found or info.course_id is distinct from cohort.course_id or info.audience='ASSIGNED' then
      raise exception 'Path item must belong to cohort course' using errcode='23514';
    end if;
    if info.parent_id is not null and not exists(select 1 from jsonb_array_elements(items) parent
      where parent->>'contentKind'=info.parent_kind and lower(parent->>'contentId')=info.parent_id::text) then
      raise exception 'Path item requires its parent' using errcode='23514';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(items) i group by i->>'contentKind',(i->>'contentId')::uuid having count(*)>1)
    or exists(select 1 from jsonb_array_elements(items) i group by (i->>'position')::integer having count(*)>1) then
    raise exception 'Duplicate path item or position' using errcode='23514';
  end if;
  insert into public.cohort_paths(cohort_id,mode,sequential,updated_at)
    values(p_cohort_id,p_mode,p_sequential,clock_timestamp())
    on conflict(cohort_id) do update set mode=excluded.mode,sequential=excluded.sequential,updated_at=excluded.updated_at;
  delete from public.cohort_path_items where cohort_id=p_cohort_id;
  insert into public.cohort_path_items(cohort_id,content_kind,content_id,position,available_from)
    select p_cohort_id,i->>'contentKind',(i->>'contentId')::uuid,(i->>'position')::integer,
      (i->>'availableFrom')::timestamptz from jsonb_array_elements(items) i;
  -- A shorter path may already be completed. Preserve COMPLETED and audit only actual transitions.
  for enrollment in select e.id from public.enrollments e where e.course_id=cohort.course_id and e.status='ACTIVE'
    and p_cohort_id in (select private.student_course_cohorts(e.user_id,e.course_id)) order by e.id loop
    perform private.complete_path_enrollment(enrollment.id);
  end loop;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
    values(auth.uid(),'cohort_path_saved','cohort',p_cohort_id,
      jsonb_build_object('before',before_state,'after',public.admin_cohort_path_get(p_cohort_id)-'catalog',
        'copiedFromCourse',p_copy_from_course),
      coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),
      left(coalesce(nullif(p_context->>'environment',''),'unknown'),40),
      left(coalesce(nullif(p_context->>'version',''),'unknown'),120));
  return public.admin_cohort_path_get(p_cohort_id);
end;
$$;

-- Effective release includes parent dates; it exposes no asset information.
create function private.cohort_path_release_at(p_cohort uuid,p_kind text,p_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare info record; release_at timestamptz;
begin
  select available_from into release_at from public.cohort_path_items
    where cohort_id=p_cohort and content_kind=p_kind and content_id=p_id;
  select * into info from private.path_content_info(p_kind,p_id);
  if info.parent_id is not null then
    release_at := greatest(release_at,private.cohort_path_release_at(p_cohort,info.parent_kind,info.parent_id));
  end if;
  return release_at;
end;
$$;

create function public.get_student_learning_path(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); enrollment public.enrollments; course public.courses; result jsonb;
begin
  if actor is null or not private.has_role('STUDENT',false) then
    raise exception 'Student required' using errcode='42501';
  end if;
  select * into enrollment from public.enrollments where user_id=actor and course_id=p_course_id
    and status in ('ACTIVE','COMPLETED');
  select * into course from public.courses where id=p_course_id and private.content_visible('courses',id);
  if enrollment.id is null or course.id is null then
    raise exception 'Enrolled published course required' using errcode='42501';
  end if;
  with paths as (
    select c.id cohort_id,coalesce(cp.mode,'DEFAULT') mode,coalesce(cp.sequential,false) sequential
      from private.student_course_cohorts(actor,p_course_id) c(id)
      left join public.cohort_paths cp on cp.cohort_id=c.id
    union all
    select null::uuid,'DEFAULT',false where not exists(select 1 from private.student_course_cohorts(actor,p_course_id))
  ), catalog as (
    select c.* from private.cohort_path_catalog(p_course_id) c
      where private.content_visible(c.content_kind,c.content_id)
        and private.student_path_includes(c.content_kind,c.content_id,actor)
        and (c.content_kind<>'materials' or exists(select 1 from public.materials m where m.id=c.content_id
          and private.has_paid_access(actor)
          and (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key))))
  ), candidates as (
    select c.*,p.cohort_id,p.mode,
      case when p.mode='CUSTOM' then i.position::bigint else c.course_position end position,
      private.cohort_path_release_at(p.cohort_id,c.content_kind,c.content_id) release_at
      from catalog c cross join paths p left join public.cohort_path_items i
        on i.cohort_id=p.cohort_id and i.content_kind=c.content_kind and i.content_id=c.content_id
      where i.content_id is not null or (p.mode='DEFAULT' and c.audience='COURSE')
  ), effective as (
    select content_kind,content_id,min(position) position,
      case when bool_or(release_at is null) then null else min(release_at) end release_at,
      jsonb_agg(jsonb_build_object('cohortId',cohort_id,'position',position,'availableFrom',release_at)
        order by cohort_id nulls last) path_positions
      from candidates group by content_kind,content_id
  )
  select jsonb_build_object('courseId',course.id,'slug',course.slug,'title',course.title,'description',course.description,
    'enrollmentId',enrollment.id,'enrollmentStatus',enrollment.status,'completedAt',enrollment.completed_at,
    'paths',(select jsonb_agg(jsonb_build_object('cohortId',cohort_id,'mode',mode,'sequential',sequential)
      order by cohort_id nulls last) from paths),
    'items',coalesce((select jsonb_agg(jsonb_build_object('contentKind',c.content_kind,'contentId',c.content_id,
      'title',c.title,'slug',c.slug,'description',c.description,'estimatedMinutes',c.estimated_minutes,
      'parentKind',c.parent_kind,'parentId',c.parent_id,'position',e.position,'availableFrom',e.release_at,
      'pathPositions',e.path_positions,'state',case
        when private.student_path_available(c.content_kind,c.content_id,actor) then 'AVAILABLE'
        when e.release_at>now() then 'LOCKED_DATE' else 'LOCKED_SEQUENCE' end)
      order by e.position,c.content_kind,c.content_id) from catalog c join effective e
        on e.content_kind=c.content_kind and e.content_id=c.content_id),'[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function private.cohort_path_catalog(uuid),private.cohort_path_release_at(uuid,text,uuid),
  public.admin_cohort_path_get(uuid),public.admin_cohort_path_save(uuid,text,boolean,jsonb,boolean,jsonb),
  public.get_student_learning_path(uuid) from public,anon,authenticated;
grant execute on function public.admin_cohort_path_get(uuid),
  public.admin_cohort_path_save(uuid,text,boolean,jsonb,boolean,jsonb),
  public.get_student_learning_path(uuid) to authenticated;
