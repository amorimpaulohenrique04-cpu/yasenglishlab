-- Enrollment Core: additive orchestration, existing Commercial/Assessment/Cohort records.
create table public.placement_cases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete restrict,
 subscription_id uuid not null references public.subscriptions(id) on delete restrict,
 assessment_attempt_id uuid unique references public.assessment_attempts(id) on delete restrict,
 membership_id uuid references public.cohort_memberships(id) on delete restrict,
 state text not null default 'PAYMENT_CONFIRMED' check(state in ('PAYMENT_CONFIRMED','ASSESSMENT_REQUIRED','IN_PROGRESS','REVIEW_PENDING','PLACEMENT_READY','STUDENT_DECISION','ENROLLED')),
 created_at timestamptz not null default now(), state_changed_at timestamptz not null default now()
);
create table public.student_schedule_preferences (
 id uuid primary key default gen_random_uuid(),
 placement_case_id uuid not null references public.placement_cases(id) on delete restrict,
 timezone text not null, weekday smallint not null check(weekday between 0 and 6),
 start_minute integer not null check(start_minute between 0 and 1439),
 end_minute integer not null check(end_minute between 1 and 1440),
 created_at timestamptz not null default now(), check(end_minute>start_minute),
 unique(placement_case_id,timezone,weekday,start_minute,end_minute)
);
create table public.cohort_placement_settings (
 cohort_id uuid primary key references public.cohorts(id) on delete restrict,
 capacity integer not null check(capacity between 1 and 6),
 schedule jsonb not null check(jsonb_typeof(schedule)='array' and jsonb_array_length(schedule) between 1 and 7),
 updated_at timestamptz not null default now()
);
create table public.placement_reviews (
 id uuid primary key default gen_random_uuid(),
 placement_case_id uuid not null unique references public.placement_cases(id) on delete restrict,
 recommended_course_id uuid not null references public.courses(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 feedback text not null check(char_length(btrim(feedback)) between 1 and 4000),
 confidence text not null check(confidence in ('LOW','MEDIUM','HIGH')),
 provenance jsonb not null, finalized_at timestamptz not null default now()
);
create table public.placement_decisions (
 id uuid primary key default gen_random_uuid(),
 placement_case_id uuid not null unique references public.placement_cases(id) on delete restrict,
 chosen_cohort_id uuid not null references public.cohorts(id) on delete restrict,
 chosen_course_id uuid not null references public.courses(id) on delete restrict,
 membership_id uuid not null references public.cohort_memberships(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.placement_transfers (
 operation_id uuid primary key,
 placement_case_id uuid not null references public.placement_cases(id) on delete restrict,
 target_cohort_id uuid not null references public.cohorts(id) on delete restrict,
 prior_membership_id uuid not null references public.cohort_memberships(id) on delete restrict,
 membership_id uuid not null references public.cohort_memberships(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 created_at timestamptz not null default now()
);

create function private.can_read_placement(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (auth.uid()=p_user and private.has_role('STUDENT',false)) or private.is_teacher_assigned(p_user) or private.has_role('ADMIN',true);
$$;
alter table public.placement_cases enable row level security;
alter table public.student_schedule_preferences enable row level security;
alter table public.cohort_placement_settings enable row level security;
alter table public.placement_reviews enable row level security;
alter table public.placement_decisions enable row level security;
alter table public.placement_transfers enable row level security;
revoke all on public.placement_cases,public.student_schedule_preferences,public.cohort_placement_settings,public.placement_reviews,public.placement_decisions,public.placement_transfers from public,anon,authenticated;
grant select(id,user_id,assessment_attempt_id,membership_id,state,created_at,state_changed_at) on public.placement_cases to authenticated;
grant select on public.student_schedule_preferences,public.placement_reviews,public.placement_decisions to authenticated;
grant select on public.cohort_placement_settings,public.placement_transfers to authenticated;
create policy placement_read on public.placement_cases for select to authenticated using(private.can_read_placement(user_id));
create policy preference_read on public.student_schedule_preferences for select to authenticated using(exists(select 1 from public.placement_cases c where c.id=placement_case_id));
create policy review_read on public.placement_reviews for select to authenticated using(exists(select 1 from public.placement_cases c where c.id=placement_case_id));
create policy decision_read on public.placement_decisions for select to authenticated using(exists(select 1 from public.placement_cases c where c.id=placement_case_id));
create policy transfer_read on public.placement_transfers for select to authenticated using(private.has_role('ADMIN',true));
create policy placement_settings_read on public.cohort_placement_settings for select to authenticated using(private.has_role('ADMIN',true));

create function private.placement_case_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if row(new.id,new.user_id,new.subscription_id,new.created_at) is distinct from row(old.id,old.user_id,old.subscription_id,old.created_at) then raise exception 'placement identity immutable' using errcode='23514'; end if;
  if old.assessment_attempt_id is not null and new.assessment_attempt_id is distinct from old.assessment_attempt_id then raise exception 'placement attempt immutable' using errcode='23514'; end if;
  if new.state<>old.state and not (
   (old.state='PAYMENT_CONFIRMED' and new.state='ASSESSMENT_REQUIRED') or
   (old.state='ASSESSMENT_REQUIRED' and new.state='IN_PROGRESS') or
   (old.state='IN_PROGRESS' and new.state='REVIEW_PENDING') or
   (old.state='REVIEW_PENDING' and new.state='PLACEMENT_READY') or
   (old.state='PLACEMENT_READY' and new.state='STUDENT_DECISION') or
   (old.state='STUDENT_DECISION' and new.state='ENROLLED')) then raise exception 'invalid placement transition' using errcode='23514'; end if;
 end if;
 if new.assessment_attempt_id is not null and not exists(select 1 from public.assessment_attempts a where a.id=new.assessment_attempt_id and a.user_id=new.user_id) then raise exception 'placement attempt ownership mismatch' using errcode='23514'; end if;
 if new.state in ('IN_PROGRESS','REVIEW_PENDING','PLACEMENT_READY','STUDENT_DECISION','ENROLLED') and new.assessment_attempt_id is null then raise exception 'placement attempt required' using errcode='23514'; end if;
 if new.state in ('REVIEW_PENDING','PLACEMENT_READY','STUDENT_DECISION','ENROLLED') and not exists(select 1 from public.assessment_attempts a where a.id=new.assessment_attempt_id and a.status in ('SUBMITTED','SCORED')) then raise exception 'completed assessment required' using errcode='23514'; end if;
 if new.state in ('PLACEMENT_READY','STUDENT_DECISION','ENROLLED') and not exists(select 1 from public.placement_reviews r where r.placement_case_id=new.id) then raise exception 'final review required' using errcode='23514'; end if;
 if new.state='ENROLLED' and not exists(select 1 from public.cohort_memberships m where m.id=new.membership_id and m.user_id=new.user_id and m.status='ACTIVE') then raise exception 'active membership required' using errcode='23514'; end if;
 if tg_op='INSERT' or new.state is distinct from old.state then
  new.state_changed_at:=clock_timestamp();
 end if;
 return new;
end $$;
create trigger placement_case_guard before insert or update on public.placement_cases for each row execute function private.placement_case_guard();
create function private.audit_placement_transition() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.state is distinct from old.state then
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_transition','placement_case',new.id,jsonb_build_object('state',new.state));
 end if;return new;
end $$;
create trigger placement_transition_audit after insert or update on public.placement_cases for each row execute function private.audit_placement_transition();
create function private.placement_history_guard() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'placement history immutable' using errcode='55000'; end $$;
create trigger review_immutable before update or delete on public.placement_reviews for each row execute function private.placement_history_guard();
create trigger decision_immutable before update or delete on public.placement_decisions for each row execute function private.placement_history_guard();
create trigger transfer_immutable before update or delete on public.placement_transfers for each row execute function private.placement_history_guard();

create function private.validate_placement_settings() returns trigger language plpgsql security definer set search_path='' as $$
declare w jsonb; occupied integer;
begin
 for w in select value from jsonb_array_elements(new.schedule) loop
  if jsonb_typeof(w)<>'object' or (w-'weekday'-'startMinute'-'endMinute')<>'{}'::jsonb or
   not (w ?& array['weekday','startMinute','endMinute']) or
   jsonb_typeof(w->'weekday') is distinct from 'number' or jsonb_typeof(w->'startMinute') is distinct from 'number' or jsonb_typeof(w->'endMinute') is distinct from 'number' or
   (w->>'weekday')::integer not between 0 and 6 or (w->>'startMinute')::integer not between 0 and 1439 or
   (w->>'endMinute')::integer not between 1 and 1440 or (w->>'endMinute')::integer<=(w->>'startMinute')::integer then raise exception 'invalid recurring schedule' using errcode='23514'; end if;
 end loop;
 perform 1 from public.cohorts where id=new.cohort_id for update;
 select count(*) into occupied from public.cohort_memberships where cohort_id=new.cohort_id and status='ACTIVE';
 if new.capacity<occupied then raise exception 'capacity below occupancy' using errcode='23514'; end if;
 if tg_op='UPDATE' and new.schedule<>old.schedule and exists(select 1 from public.cohort_memberships where cohort_id=new.cohort_id) then raise exception 'occupied schedule immutable' using errcode='23514'; end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
create trigger placement_settings_guard before insert or update on public.cohort_placement_settings for each row execute function private.validate_placement_settings();
create function public.configure_cohort_placement(p_cohort_id uuid,p_capacity integer,p_schedule jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN aal2 required' using errcode='42501'; end if;
 perform 1 from public.cohorts where id=p_cohort_id for update;
 if not found then raise exception 'cohort not found' using errcode='23503'; end if;
 if exists(select 1 from public.cohort_placement_settings where cohort_id=p_cohort_id and capacity=p_capacity and schedule=p_schedule) then return; end if;
 insert into public.cohort_placement_settings(cohort_id,capacity,schedule) values(p_cohort_id,p_capacity,p_schedule)
 on conflict(cohort_id) do update set capacity=excluded.capacity,schedule=excluded.schedule;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'cohort_placement_configured','cohort',p_cohort_id,jsonb_build_object('capacity',p_capacity));
end $$;

-- All membership writers share the capacity lock, including existing manage_cohort.
create function private.placement_capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare cap integer;
begin
 if new.status='ACTIVE' then
  perform 1 from public.cohorts where id=new.cohort_id for update;
  select capacity into cap from public.cohort_placement_settings where cohort_id=new.cohort_id;
  if cap is not null and (select count(*) from public.cohort_memberships where cohort_id=new.cohort_id and status='ACTIVE' and id<>new.id)>=cap then raise exception 'cohort_capacity_exhausted' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger placement_capacity_guard before insert or update on public.cohort_memberships for each row execute function private.placement_capacity_guard();

create function public.begin_placement() returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; sub uuid;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select id into target from public.placement_cases where user_id=auth.uid();
 if target is not null then return target; end if;
 select id into sub from public.subscriptions where user_id=auth.uid() and status='ACTIVE' and started_at<=now() and (ended_at is null or ended_at>now()) and (current_period_start is null or current_period_start<=now()) and (current_period_end is null or current_period_end>now()) order by created_at desc limit 1;
 if sub is null then raise exception 'confirmed commercial state required' using errcode='42501'; end if;
 insert into public.placement_cases(user_id,subscription_id) values(auth.uid(),sub) on conflict(user_id) do nothing returning id into target;
 if target is null then select id into target from public.placement_cases where user_id=auth.uid(); end if;
 return target;
end $$;
create function public.save_placement_preferences(p_timezone text,p_weekday integer,p_start_minute integer,p_end_minute integer) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null or c.state not in ('PAYMENT_CONFIRMED','ASSESSMENT_REQUIRED','IN_PROGRESS','REVIEW_PENDING','PLACEMENT_READY','STUDENT_DECISION') then raise exception 'placement preferences unavailable' using errcode='23514'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid timezone' using errcode='23514'; end if;
 if c.state<>'PAYMENT_CONFIRMED' and (select count(*) from public.student_schedule_preferences where placement_case_id=c.id)=1 and exists(select 1 from public.student_schedule_preferences where placement_case_id=c.id and timezone=p_timezone and weekday=p_weekday and start_minute=p_start_minute and end_minute=p_end_minute) then return c.id; end if;
 delete from public.student_schedule_preferences where placement_case_id=c.id;
 insert into public.student_schedule_preferences(placement_case_id,timezone,weekday,start_minute,end_minute) values(c.id,p_timezone,p_weekday,p_start_minute,p_end_minute);
 if c.state='PAYMENT_CONFIRMED' then update public.placement_cases set state='ASSESSMENT_REQUIRED' where id=c.id; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_preferences_saved','placement_case',c.id,'{}');
 return c.id;
end $$;
create function public.start_placement_assessment() returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; v uuid; a public.assessment_attempts;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 if c.assessment_attempt_id is not null then return c.assessment_attempt_id; end if;
 if c.state<>'ASSESSMENT_REQUIRED' then raise exception 'onboarding preferences required' using errcode='23514'; end if;
 select av.id into v from public.assessment_versions av join public.assessments assessment on assessment.id=av.assessment_id where av.status='PUBLISHED' and assessment.active and exists(select 1 from public.assessment_items i where i.assessment_version_id=av.id) order by av.published_at desc,av.id limit 1;
 if v is null then raise exception 'published assessment unavailable' using errcode='23514'; end if;
 select * into a from public.assessment_attempts where user_id=c.user_id and status in ('IN_PROGRESS','SUBMITTED','SCORED') order by started_at desc,id limit 1;
 if a.id is null then a:=public.start_assessment_attempt(v,c.id); end if;
 update public.placement_cases set assessment_attempt_id=a.id,state='IN_PROGRESS' where id=c.id;
 if a.status in ('SUBMITTED','SCORED') then update public.placement_cases set state='REVIEW_PENDING' where id=c.id; end if;
 return a.id;
end $$;
create function private.placement_assessment_completed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('SUBMITTED','SCORED') and old.status='IN_PROGRESS' then
  update public.placement_cases set state='REVIEW_PENDING' where assessment_attempt_id=new.id and state='IN_PROGRESS';
 end if;return new;
end $$;
create trigger placement_assessment_completed after update on public.assessment_attempts for each row execute function private.placement_assessment_completed();

create function public.finalize_placement_review(p_case_id uuid,p_course_id uuid,p_feedback text,p_confidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; r public.placement_reviews;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 select * into c from public.placement_cases where id=p_case_id for update;
 if c.id is null or not private.is_teacher_assigned(c.user_id) then raise exception 'Teacher scope required' using errcode='42501'; end if;
 select * into r from public.placement_reviews where placement_case_id=c.id;
 if r.id is not null then
  if row(r.actor_user_id,r.recommended_course_id,r.feedback,r.confidence) is distinct from row(auth.uid(),p_course_id,btrim(p_feedback),p_confidence) then raise exception 'conflicting finalized review' using errcode='23514'; end if;
  return r.id;
 end if;
 if c.state<>'REVIEW_PENDING' then raise exception 'review pending required' using errcode='23514'; end if;
 if not exists(select 1 from public.courses where id=p_course_id and active and publication_status='PUBLISHED') then raise exception 'published operational track required' using errcode='23514'; end if;
 insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance) values(c.id,p_course_id,auth.uid(),btrim(p_feedback),p_confidence,jsonb_build_object('method','teacher-placement-v1','assessment_attempt_id',c.assessment_attempt_id,'official_cefr',false)) returning id into r.id;
 update public.placement_cases set state='PLACEMENT_READY' where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_review_finalized','placement_case',c.id,jsonb_build_object('review_id',r.id,'course_id',p_course_id));
 return r.id;
end $$;
create function private.placement_cohort_compatible(p_case_id uuid,p_cohort_id uuid,p_require_track boolean default true) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cohorts co join public.courses course on course.id=co.course_id join public.cohort_placement_settings settings on settings.cohort_id=co.id join public.placement_reviews r on r.placement_case_id=p_case_id
 where co.id=p_cohort_id and co.status='ACTIVE' and (co.ends_at is null or co.ends_at>now()) and course.active and course.publication_status='PUBLISHED'
 and (not p_require_track or co.course_id=r.recommended_course_id)
 and not exists(select 1 from jsonb_array_elements(settings.schedule) w where not exists(select 1 from public.student_schedule_preferences pref where pref.placement_case_id=p_case_id and pref.timezone=co.timezone and pref.weekday=(w->>'weekday')::integer and pref.start_minute<=(w->>'startMinute')::integer and pref.end_minute>=(w->>'endMinute')::integer)));
$$;
create function public.open_placement_decision() returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null or c.state not in ('PLACEMENT_READY','STUDENT_DECISION','ENROLLED') then raise exception 'placement not ready' using errcode='23514'; end if;
 if c.state='PLACEMENT_READY' then update public.placement_cases set state='STUDENT_DECISION' where id=c.id; end if;
 return c.id;
end $$;
create function public.get_placement_candidates(p_case_id uuid) returns setof jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.placement_cases;
begin
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or auth.uid() is null or not private.can_read_placement(c.user_id) then raise exception 'placement scope required' using errcode='42501'; end if;
 if c.state not in ('PLACEMENT_READY','STUDENT_DECISION','ENROLLED') then return; end if;
 return query select jsonb_build_object('id',co.id,'name',co.name,'courseId',co.course_id,'timezone',co.timezone,'schedule',settings.schedule,'capacity',settings.capacity,'occupancy',(select count(*) from public.cohort_memberships m where m.cohort_id=co.id and m.status='ACTIVE'),'startsAt',co.starts_at)
 from public.cohorts co join public.cohort_placement_settings settings on settings.cohort_id=co.id
 where private.placement_cohort_compatible(c.id,co.id,true) and (select count(*) from public.cohort_memberships m where m.cohort_id=co.id and m.status='ACTIVE')<settings.capacity order by co.starts_at,co.id;
end $$;
create function public.confirm_placement_choice(p_cohort_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; d public.placement_decisions; co public.cohorts; e uuid; m uuid;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 select * into d from public.placement_decisions where placement_case_id=c.id;
 if d.id is not null then
  if d.chosen_cohort_id is distinct from p_cohort_id then raise exception 'conflicting placement choice' using errcode='23514'; end if;return d.membership_id;
 end if;
 if c.state<>'STUDENT_DECISION' then raise exception 'student decision required' using errcode='23514'; end if;
 select * into co from public.cohorts where id=p_cohort_id for update;
 if co.id is null or not private.placement_cohort_compatible(c.id,co.id,true) then raise exception 'cohort incompatible' using errcode='23514'; end if;
 if not exists(select 1 from public.subscriptions where id=c.subscription_id and user_id=c.user_id and status='ACTIVE' and (ended_at is null or ended_at>now()) and (current_period_end is null or current_period_end>now())) then raise exception 'confirmed commercial state required' using errcode='42501'; end if;
 select id into e from public.enrollments where user_id=c.user_id and course_id=co.course_id and status='ACTIVE' order by created_at desc limit 1;
 if e is null then insert into public.enrollments(user_id,course_id,status) values(c.user_id,co.course_id,'ACTIVE') on conflict(user_id,course_id) do update set status='ACTIVE',completed_at=null returning id into e; end if;
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(co.id,c.user_id,e) returning id into m;
 insert into public.placement_decisions(placement_case_id,chosen_cohort_id,chosen_course_id,membership_id) values(c.id,co.id,co.course_id,m);
 update public.placement_cases set state='ENROLLED',membership_id=m where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_choice_confirmed','placement_case',c.id,jsonb_build_object('membership_id',m,'cohort_id',co.id));
 return m;
end $$;

create function public.transfer_placement_cohort(p_case_id uuid,p_cohort_id uuid,p_operation_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; prior public.cohort_memberships; co public.cohorts; t public.placement_transfers; e uuid; m uuid;
begin
 if auth.uid() is null or not private.has_role('ADMIN',true) then raise exception 'ADMIN aal2 required' using errcode='42501'; end if;
 if p_operation_id is null or nullif(btrim(p_reason),'') is null then raise exception 'operation and reason required' using errcode='23514'; end if;
 select * into c from public.placement_cases where id=p_case_id for update;
 if c.id is null or c.state<>'ENROLLED' then raise exception 'enrolled placement required' using errcode='23514'; end if;
 select * into t from public.placement_transfers where operation_id=p_operation_id;
 if t.operation_id is not null then
  if row(t.placement_case_id,t.target_cohort_id,t.actor_user_id,t.reason) is distinct from row(c.id,p_cohort_id,auth.uid(),btrim(p_reason)) then raise exception 'conflicting transfer retry' using errcode='23514'; end if;return t.membership_id;
 end if;
 select * into prior from public.cohort_memberships where id=c.membership_id;
 perform 1 from public.cohorts where id in (prior.cohort_id,p_cohort_id) order by id for update;
 select * into co from public.cohorts where id=p_cohort_id;
 if co.id=prior.cohort_id or not private.placement_cohort_compatible(c.id,p_cohort_id,false) then raise exception 'transfer cohort incompatible' using errcode='23514'; end if;
 select id into e from public.enrollments where user_id=c.user_id and course_id=co.course_id and status='ACTIVE' order by created_at desc limit 1;
 if e is null then insert into public.enrollments(user_id,course_id,status) values(c.user_id,co.course_id,'ACTIVE') on conflict(user_id,course_id) do update set status='ACTIVE',completed_at=null returning id into e; end if;
 update public.cohort_memberships set status='LEFT',ends_at=clock_timestamp() where id=prior.id;
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(co.id,c.user_id,e) returning id into m;
 update public.placement_cases set membership_id=m where id=c.id;
 insert into public.placement_transfers(operation_id,placement_case_id,target_cohort_id,prior_membership_id,membership_id,actor_user_id,reason) values(p_operation_id,c.id,co.id,prior.id,m,auth.uid(),btrim(p_reason));
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_cohort_transferred','placement_case',c.id,jsonb_build_object('operation_id',p_operation_id,'membership_id',m));
 return m;
end $$;

-- Private rubric is exposed only by this scoped Teacher read; never by Student item reads.
create function public.get_placement_review_evidence(p_case_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.placement_cases;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or not private.is_teacher_assigned(c.user_id) then raise exception 'Teacher scope required' using errcode='42501'; end if;
 return jsonb_build_object('attemptId',c.assessment_attempt_id,'scores',coalesce((select jsonb_agg(jsonb_build_object('skill',skill,'score',score,'maxScore',max_score,'provenance',provenance)) from public.skill_scores where assessment_attempt_id=c.assessment_attempt_id),'[]'::jsonb),
 'responses',coalesce((select jsonb_agg(jsonb_build_object('skill',i.skill,'prompt',i.prompt,'response',r.response,'rubric',i.rubric,'score',r.score) order by i.position) from public.assessment_responses r join public.assessment_items i on i.id=r.assessment_item_id where r.assessment_attempt_id=c.assessment_attempt_id),'[]'::jsonb));
end $$;

revoke all on function private.can_read_placement(uuid),private.placement_case_guard(),private.audit_placement_transition(),private.placement_history_guard(),private.validate_placement_settings(),private.placement_capacity_guard(),private.placement_assessment_completed(),private.placement_cohort_compatible(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.can_read_placement(uuid) to authenticated;
revoke all on function public.begin_placement(),public.save_placement_preferences(text,integer,integer,integer),public.start_placement_assessment(),public.finalize_placement_review(uuid,uuid,text,text),public.open_placement_decision(),public.get_placement_candidates(uuid),public.confirm_placement_choice(uuid),public.transfer_placement_cohort(uuid,uuid,uuid,text),public.configure_cohort_placement(uuid,integer,jsonb),public.get_placement_review_evidence(uuid) from public,anon,authenticated;
grant execute on function public.begin_placement(),public.save_placement_preferences(text,integer,integer,integer),public.start_placement_assessment(),public.finalize_placement_review(uuid,uuid,text,text),public.open_placement_decision(),public.get_placement_candidates(uuid),public.confirm_placement_choice(uuid),public.transfer_placement_cohort(uuid,uuid,uuid,text),public.configure_cohort_placement(uuid,integer,jsonb),public.get_placement_review_evidence(uuid) to authenticated;

create index placement_cases_queue_idx on public.placement_cases(state,state_changed_at,id);
create index schedule_preferences_case_idx on public.student_schedule_preferences(placement_case_id);
create index placement_transfers_case_idx on public.placement_transfers(placement_case_id);
create function public.get_placement_projection(p_case_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.placement_cases;
begin
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or auth.uid() is null or not private.can_read_placement(c.user_id) then raise exception 'placement scope required' using errcode='42501'; end if;
 return jsonb_build_object('displayName',(select display_name from public.profiles where user_id=c.user_id),'case',jsonb_build_object('id',c.id,'user_id',c.user_id,'state',c.state,'assessment_attempt_id',c.assessment_attempt_id,'membership_id',c.membership_id,'created_at',c.created_at,'state_changed_at',c.state_changed_at),
 'preferences',coalesce((select jsonb_agg(jsonb_build_object('timezone',timezone,'weekday',weekday,'startMinute',start_minute,'endMinute',end_minute)) from public.student_schedule_preferences where placement_case_id=c.id),'[]'::jsonb),
 'review',(select to_jsonb(r)-'actor_user_id'-'placement_case_id' from public.placement_reviews r where placement_case_id=c.id),
 'decision',(select to_jsonb(d)-'id'-'placement_case_id' from public.placement_decisions d where placement_case_id=c.id),
 'recommendedTitle',(select course.title from public.placement_reviews r join public.courses course on course.id=r.recommended_course_id where r.placement_case_id=c.id),
 'chosenTitle',(select course.title from public.placement_decisions d join public.courses course on course.id=d.chosen_course_id where d.placement_case_id=c.id),
 'currentCohort',(select co.name from public.cohort_memberships m join public.cohorts co on co.id=m.cohort_id where m.id=c.membership_id),
 'assessmentSummary',(select jsonb_build_object('status',a.status,'submittedAt',a.submitted_at,'objectiveScore',(a.result_metadata->>'objective_score')::numeric,'pendingCount',(a.result_metadata->>'pending_item_count')::integer) from public.assessment_attempts a where a.id=c.assessment_attempt_id));
end $$;
create function public.get_placement_queue(p_state text default null,p_workspace text default 'ADMIN') returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or p_workspace not in ('ADMIN','TEACHER') or not private.has_role(p_workspace,true) then raise exception 'staff aal2 required' using errcode='42501'; end if;
 return query select public.get_placement_projection(c.id) from public.placement_cases c where (p_workspace='ADMIN' or private.is_teacher_assigned(c.user_id)) and (p_state is null or c.state=p_state) order by c.state_changed_at,c.id limit 100;
end $$;
revoke all on function public.get_placement_projection(uuid),public.get_placement_queue(text,text) from public,anon,authenticated;
grant execute on function public.get_placement_projection(uuid),public.get_placement_queue(text,text) to authenticated;

alter table public.product_analytics_events drop constraint product_analytics_events_event_name_check;
alter table public.product_analytics_events add constraint product_analytics_events_event_name_check check(event_name in (
 'signup_completed','login_completed','subscription_started','subscription_upgraded','subscription_downgraded','subscription_cancelled',
 'lesson_started','lesson_progressed','lesson_completed','module_completed','practice_started','practice_completed','material_opened','material_favorited','assessment_started','assessment_completed','live_session_booked','live_session_cancelled','live_session_attended',
 'lesson_video_started','lesson_video_resumed','lesson_video_completed','onboarding_started','placement_review_finalized','placement_ready','placement_choice_confirmed','enrollment_completed'));
alter function public.track_product_event(text,uuid,jsonb,text) rename to track_product_event_pre_placement;
revoke all on function public.track_product_event_pre_placement(text,uuid,jsonb,text) from public,anon,authenticated;
create function public.track_product_event(p_event_name text,p_lesson_id uuid default null,p_properties jsonb default '{}',p_idempotency_key text default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.placement_cases;
begin
 if p_event_name not in ('onboarding_started','placement_review_finalized','placement_ready','placement_choice_confirmed','enrollment_completed') then perform public.track_product_event_pre_placement(p_event_name,p_lesson_id,p_properties,p_idempotency_key);return;end if;
 if auth.uid() is null or p_lesson_id is not null or jsonb_typeof(p_properties) is distinct from 'object' or (p_properties-'placement_case_id')<>'{}'::jsonb then raise exception 'minimized placement event required' using errcode='23514'; end if;
 select * into c from public.placement_cases where id=(p_properties->>'placement_case_id')::uuid;
 if c.id is null or p_idempotency_key is distinct from p_event_name||':'||c.id::text then raise exception 'persisted placement event required' using errcode='42501';end if;
 if p_event_name in ('placement_review_finalized','placement_ready') then
  if not private.has_role('TEACHER',true) or not private.is_teacher_assigned(c.user_id) or not exists(select 1 from public.placement_reviews where placement_case_id=c.id and actor_user_id=auth.uid()) then raise exception 'review event unauthorized' using errcode='42501';end if;
 else
  if not private.has_role('STUDENT',false) or c.user_id<>auth.uid() then raise exception 'placement event unauthorized' using errcode='42501';end if;
  if p_event_name in ('placement_choice_confirmed','enrollment_completed') and c.state<>'ENROLLED' then raise exception 'persisted enrollment required' using errcode='42501';end if;
 end if;
 insert into public.product_analytics_events(user_id,event_name,properties,idempotency_key) values(auth.uid(),p_event_name,p_properties,p_idempotency_key) on conflict do nothing;
end $$;
revoke all on function public.track_product_event(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.track_product_event(text,uuid,jsonb,text) to authenticated;
