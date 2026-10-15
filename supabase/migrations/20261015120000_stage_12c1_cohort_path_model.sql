-- ADR 0022: cohort paths. No direct Data API access; C2 supplies admin/student RPCs.
alter table public.modules add column audience text not null default 'COURSE'
  check (audience in ('COURSE','COHORTS'));
alter table public.lessons add column audience text not null default 'COURSE'
  check (audience in ('COURSE','COHORTS'));
alter table public.materials add column audience text not null default 'COURSE'
  check (audience in ('COURSE','COHORTS'));
alter table public.practice_activities drop constraint practice_activities_audience_check;
alter table public.practice_activities add constraint practice_activities_audience_check
  check (audience in ('COURSE','COHORTS','ASSIGNED'));
alter table public.practice_activities drop constraint practice_activities_assigned_scope;
alter table public.practice_activities add constraint practice_activities_assigned_scope
  check (audience <> 'ASSIGNED' or (created_by_teacher_id is not null and course_id is not null));

create table public.cohort_paths (
  cohort_id uuid primary key references public.cohorts(id) on delete cascade,
  mode text not null default 'DEFAULT' check (mode in ('DEFAULT','CUSTOM')),
  sequential boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.cohort_path_items (
  cohort_id uuid not null references public.cohort_paths(cohort_id) on delete cascade,
  content_kind text not null check (content_kind in ('modules','lessons','materials','practice_activities')),
  content_id uuid not null,
  position integer not null check (position >= 0),
  available_from timestamptz,
  primary key (cohort_id,content_kind,content_id),
  unique (cohort_id,position) deferrable initially deferred
);
create index cohort_path_items_content_idx on public.cohort_path_items(content_kind,content_id,cohort_id);
alter table public.cohort_paths enable row level security;
alter table public.cohort_path_items enable row level security;
revoke all on public.cohort_paths, public.cohort_path_items from public, anon, authenticated;

-- Resolve polymorphic references without relying on caller RLS (which uses these helpers).
create function private.path_content_info(p_kind text,p_id uuid)
returns table(course_id uuid,audience text,parent_kind text,parent_id uuid)
language sql stable security definer set search_path = '' as $$
  select m.course_id,m.audience,null::text,null::uuid from public.modules m where p_kind='modules' and m.id=p_id
  union all
  select m.course_id,l.audience,'modules',l.module_id from public.lessons l join public.modules m on m.id=l.module_id
    where p_kind='lessons' and l.id=p_id
  union all
  select mo.course_id,m.audience,
    case when m.lesson_id is not null then 'lessons' when m.module_id is not null then 'modules' end,
    coalesce(m.lesson_id,m.module_id)
    from public.materials m left join public.lessons l on l.id=m.lesson_id
    left join public.modules mo on mo.id=coalesce(l.module_id,m.module_id)
    where p_kind='materials' and m.id=p_id
  union all
  select coalesce(a.course_id,mo.course_id),a.audience,
    case when a.related_lesson_id is not null then 'lessons' when a.related_module_id is not null then 'modules' end,
    coalesce(a.related_lesson_id,a.related_module_id)
    from public.practice_activities a left join public.lessons l on l.id=a.related_lesson_id
    left join public.modules mo on mo.id=coalesce(l.module_id,a.related_module_id)
    where p_kind='practice_activities' and a.id=p_id;
$$;

create function private.validate_cohort_path_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare info record; item record;
begin
  -- Deferred validation sees the final replacement. Deleting a parent must also validate its children.
  for item in select i.*,c.course_id from public.cohort_path_items i join public.cohorts c on c.id=i.cohort_id
    where i.cohort_id in (new.cohort_id,old.cohort_id) loop
    select * into info from private.path_content_info(item.content_kind,item.content_id);
    if info.course_id is null or info.course_id is distinct from item.course_id or info.audience='ASSIGNED' then
      raise exception 'Path item must belong to cohort course; assigned practices use assignments' using errcode='23514';
    end if;
    if info.parent_id is not null and not exists(select 1 from public.cohort_path_items
      where cohort_id=item.cohort_id and content_kind=info.parent_kind and content_id=info.parent_id) then
      raise exception 'Path item requires its parent in the path' using errcode='23514';
    end if;
  end loop;
  return null;
end;
$$;
create constraint trigger cohort_path_item_valid after insert or update or delete on public.cohort_path_items
  deferrable initially deferred for each row execute function private.validate_cohort_path_item();

-- Include COMPLETED enrollments: completion must not remove the student's path or access.
create function private.student_course_cohorts(p_user uuid,p_course uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.cohort_memberships cm join public.cohorts c on c.id=cm.cohort_id
    join public.enrollments e on e.id=cm.enrollment_id
  where cm.user_id=p_user and e.user_id=p_user and e.course_id=p_course and c.course_id=p_course
    and e.status in ('ACTIVE','COMPLETED') and cm.status='ACTIVE' and c.status='ACTIVE'
    and cm.starts_at<=now() and (cm.ends_at is null or cm.ends_at>now());
$$;

create function private.student_path_includes(p_kind text,p_id uuid,p_user uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare info record;
begin
  if p_user is null then return false; end if;
  select * into info from private.path_content_info(p_kind,p_id);
  if not found then return false; end if;
  if info.course_id is null then
    return info.audience='COURSE' and exists(select 1 from public.enrollments
      where user_id=p_user and status in ('ACTIVE','COMPLETED'));
  end if;
  if not private.has_course_enrollment(p_user,info.course_id) then return false; end if;
  if info.audience='ASSIGNED' then
    return exists(select 1 from public.cohort_practice_assignments a
      where a.practice_activity_id=p_id and a.cohort_id in
        (select private.student_course_cohorts(p_user,info.course_id)));
  end if;
  if info.parent_id is not null and not private.student_path_includes(info.parent_kind,info.parent_id,p_user) then
    return false;
  end if;
  return exists(
    select 1 from private.student_course_cohorts(p_user,info.course_id) c(id)
      left join public.cohort_paths cp on cp.cohort_id=c.id
    where (coalesce(cp.mode,'DEFAULT')='DEFAULT' and info.audience='COURSE')
      or exists(select 1 from public.cohort_path_items i
        where i.cohort_id=c.id and i.content_kind=p_kind and i.content_id=p_id)
  ) or (info.audience='COURSE' and not exists(select 1 from private.student_course_cohorts(p_user,info.course_id)));
end;
$$;

create function private.student_path_available(p_kind text,p_id uuid,p_user uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare info record;
begin
  if not private.student_path_includes(p_kind,p_id,p_user) then return false; end if;
  select * into info from private.path_content_info(p_kind,p_id);
  if info.audience='ASSIGNED' then return true; end if;
  if info.parent_id is not null and not private.student_path_available(info.parent_kind,info.parent_id,p_user) then
    return false;
  end if;
  if info.course_id is null or not exists(select 1 from private.student_course_cohorts(p_user,info.course_id)) then
    return true;
  end if;
  return exists(
    select 1 from private.student_course_cohorts(p_user,info.course_id) c(id)
      left join public.cohort_paths cp on cp.cohort_id=c.id
      left join public.cohort_path_items i on i.cohort_id=c.id and i.content_kind=p_kind and i.content_id=p_id
    where (i.content_id is not null or (coalesce(cp.mode,'DEFAULT')='DEFAULT' and info.audience='COURSE'))
      and (i.available_from is null or i.available_from<=now())
      and (p_kind<>'lessons' or not coalesce(cp.sequential,false) or not exists(
        select 1 from public.lessons previous join public.modules pm on pm.id=previous.module_id
          left join public.cohort_path_items pi on pi.cohort_id=c.id and pi.content_kind='lessons' and pi.content_id=previous.id
          join public.lessons current_lesson on current_lesson.id=p_id
          join public.modules current_module on current_module.id=current_lesson.module_id
        where pm.course_id=info.course_id and private.content_visible('lessons',previous.id)
          and ((cp.mode='CUSTOM' and pi.position<i.position)
            or (cp.mode='DEFAULT' and private.student_path_includes('lessons',previous.id,p_user)
              and row(pm.position,pm.id,previous.position,previous.id)<row(current_module.position,current_module.id,current_lesson.position,current_lesson.id)))
          and not exists(select 1 from public.lesson_progress lp where lp.user_id=p_user
            and lp.lesson_id=previous.id and lp.status='COMPLETED')
      ))
  );
end;
$$;

-- Intersect student consumption with existing publication, entitlement and staff rules.
CREATE OR REPLACE FUNCTION private.can_read_material(p_material_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.materials m where m.id=p_material_id and (
  private.has_role('ADMIN',true) or (private.content_visible('materials',m.id) and (
    private.has_role('TEACHER',true) or (
      private.student_path_available('materials',m.id,auth.uid()) and private.has_paid_access(auth.uid()) and
      (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key)) and (
        (m.module_id is null and m.lesson_id is null) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id
          where e.user_id=auth.uid() and e.status in ('ACTIVE','COMPLETED') and mo.id=m.module_id
        ) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id join public.lessons l on l.module_id=mo.id
          where e.user_id=auth.uid() and e.status in ('ACTIVE','COMPLETED') and l.id=m.lesson_id
        )
      )
    )
  ))
));
$function$

;

CREATE OR REPLACE FUNCTION private.can_read_lesson_asset(p_lesson_asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id join public.modules m on m.id=l.module_id
where a.id=p_lesson_asset_id and (private.has_role('ADMIN',true) or (
 private.content_visible('lesson_assets',a.id) and (private.has_role('TEACHER',true) or (
  private.student_path_available('lessons',l.id,auth.uid()) and private.has_paid_access(auth.uid()) and
  (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)) and exists (
   select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=m.course_id and e.status in ('ACTIVE','COMPLETED')
  )
 ))
)));
$function$

;

create or replace function private.can_view_practice_activity(p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('ADMIN', true)
    or (
      private.content_visible('practice_activities', p_activity)
      and exists (
        select 1 from public.practice_activities a
        where a.id = p_activity
          and auth.uid() is not null
          and (private.has_role('TEACHER',true) or private.student_path_available('practice_activities',a.id,auth.uid()))
          and case when a.audience = 'ASSIGNED' then
            -- Teachers: only the author and Teachers of an assigned cohort. Students: assigned cohort + membership + enrollment.
            (private.has_role('TEACHER', true) and (
               exists (select 1 from public.teachers t where t.id = a.created_by_teacher_id and t.user_id = auth.uid())
               or exists (select 1 from public.cohort_practice_assignments pa
                          where pa.practice_activity_id = a.id and private.is_cohort_teacher(pa.cohort_id))))
            or (a.course_id is not null and private.has_course_enrollment(auth.uid(), a.course_id)
                and exists (select 1 from public.cohort_practice_assignments pa
                            where pa.practice_activity_id = a.id and private.has_cohort_membership(pa.cohort_id, auth.uid())))
          else
            -- Stage 11 rule, unchanged.
            private.has_role('TEACHER', true)
            or (a.related_module_id is null and a.related_lesson_id is null
                and exists (select 1 from public.enrollments e
                  where e.user_id = auth.uid() and e.status in ('ACTIVE', 'COMPLETED')))
            or ((a.related_module_id is not null or a.related_lesson_id is not null)
                and (a.related_module_id is null or exists (
                  select 1 from public.modules m
                  where m.id = a.related_module_id and private.has_course_enrollment(auth.uid(), m.course_id)))
                and (a.related_lesson_id is null or exists (
                  select 1 from public.lessons l join public.modules m on m.id = l.module_id
                  where l.id = a.related_lesson_id and private.has_course_enrollment(auth.uid(), m.course_id))))
          end
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.record_lesson_progress(p_lesson_id uuid, p_completion_percent numeric, p_last_position_seconds integer DEFAULT NULL::integer)
 RETURNS lesson_progress
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and e.status in ('ACTIVE', 'COMPLETED')
    and c.active
        and private.content_visible('modules',m.id)
    and l.id = p_lesson_id
        and private.content_visible('lessons',l.id)
  order by e.enrolled_at desc, e.id
  limit 1;

  if enrollment_id is null then
    raise exception 'Active enrollment in a published course required' using errcode = '42501';
  end if;

  if not private.student_path_available('lessons',p_lesson_id,actor_user_id) then
    raise exception 'Lesson unavailable in student path' using errcode='42501';
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
$function$

;

create function private.complete_path_enrollment(p_enrollment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_total integer;
  v_done integer;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment for no key update;
  if v_enrollment.id is null or v_enrollment.status <> 'ACTIVE' then
    return;
  end if;

  select count(*), count(*) filter (where lp.status = 'COMPLETED')
    into v_total, v_done
  from public.modules m
  join public.lessons l on l.module_id = m.id
  left join public.lesson_progress lp on lp.enrollment_id = v_enrollment.id and lp.lesson_id = l.id
  where m.course_id = v_enrollment.course_id
    and private.content_visible('lessons', l.id)
    and private.student_path_includes('lessons',l.id,v_enrollment.user_id);

  if v_total = 0 or v_done < v_total then
    return;
  end if;

  update public.enrollments set status = 'COMPLETED', completed_at = now()
    where id = v_enrollment.id and status = 'ACTIVE';
  if found then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'enrollment_course_completed', 'enrollment', v_enrollment.id,
      jsonb_build_object('course_id', v_enrollment.course_id, 'lessons_total', v_total));
  end if;
  return;
end;
$$;
revoke all on function private.complete_path_enrollment(uuid) from public, anon, authenticated;
create or replace function private.complete_enrollment_on_last_lesson()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='COMPLETED' then perform private.complete_path_enrollment(new.enrollment_id); end if;
  return null;
end;
$$;
create function private.complete_enrollment_on_path_transfer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='ACTIVE' and new.starts_at<=now() and (new.ends_at is null or new.ends_at>now()) then
    perform private.complete_path_enrollment(new.enrollment_id);
  end if;
  return null;
end;
$$;
revoke all on function private.complete_enrollment_on_path_transfer() from public, anon, authenticated;
create trigger cohort_membership_path_completion after insert or update on public.cohort_memberships
  for each row execute function private.complete_enrollment_on_path_transfer();


-- Only actor-bound helpers are executable by authenticated clients.
create function private.can_read_learning_metadata(p_kind text,p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('ADMIN',true) or (private.content_visible(p_kind,p_id) and (
    private.has_role('TEACHER',true) or
    case when p_kind='courses' then
      private.has_course_enrollment(auth.uid(),p_id) or exists(
        select 1 from public.placement_reviews r join public.placement_cases c on c.id=r.placement_case_id
        where c.user_id=auth.uid() and r.recommended_course_id=p_id)
    else private.student_path_includes(p_kind,p_id,auth.uid()) end
  ));
$$;
revoke all on function private.path_content_info(text,uuid), private.validate_cohort_path_item(),
  private.student_course_cohorts(uuid,uuid), private.student_path_includes(text,uuid,uuid),
  private.student_path_available(text,uuid,uuid), private.can_read_learning_metadata(text,uuid)
  from public, anon, authenticated;
grant execute on function private.can_read_learning_metadata(text,uuid) to authenticated;

drop policy courses_authenticated_select on public.courses;
create policy courses_authenticated_select on public.courses for select to authenticated
  using (private.can_read_learning_metadata('courses',id));
drop policy modules_authenticated_select on public.modules;
create policy modules_authenticated_select on public.modules for select to authenticated
  using (private.can_read_learning_metadata('modules',id));
drop policy lessons_authenticated_select on public.lessons;
create policy lessons_authenticated_select on public.lessons for select to authenticated
  using (private.can_read_learning_metadata('lessons',id));

-- Polymorphic references must remain valid when Admin Content moves/deletes their source records.
-- Remove an item from its paths first; changing titles/publication/audience COURSE<->COHORTS is allowed.
create function private.guard_path_content_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare before_row jsonb := to_jsonb(old); after_row jsonb := to_jsonb(new); referenced boolean;
begin
  if tg_table_name='cohorts' then
    referenced := exists(select 1 from public.cohort_path_items where cohort_id=old.id);
  else
    referenced := exists(select 1 from public.cohort_path_items where content_kind=tg_table_name and content_id=old.id);
  end if;
  if referenced and (tg_op='DELETE' or
    row(before_row->'id',before_row->'course_id',before_row->'module_id',before_row->'lesson_id',before_row->'related_module_id',before_row->'related_lesson_id')
      is distinct from
    row(after_row->'id',after_row->'course_id',after_row->'module_id',after_row->'lesson_id',after_row->'related_module_id',after_row->'related_lesson_id')
    or (tg_table_name='practice_activities' and after_row->>'audience'='ASSIGNED')) then
    raise exception 'Remove cohort path references before moving or deleting content' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_path_content_reference() from public, anon, authenticated;
create trigger cohort_path_reference_guard before update or delete on public.modules
  for each row execute function private.guard_path_content_reference();
create trigger cohort_path_reference_guard before update or delete on public.lessons
  for each row execute function private.guard_path_content_reference();
create trigger cohort_path_reference_guard before update or delete on public.materials
  for each row execute function private.guard_path_content_reference();
create trigger cohort_path_reference_guard before update or delete on public.practice_activities
  for each row execute function private.guard_path_content_reference();
create trigger cohort_path_reference_guard before update or delete on public.cohorts
  for each row execute function private.guard_path_content_reference();
