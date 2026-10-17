-- PR1 / Block 1B: the staff placement queue is paginated (deterministic order + total) instead of
-- silently truncating at 100 rows.
drop function public.get_placement_queue(text, text);
create function public.get_placement_queue(
  p_state text default null,
  p_workspace text default 'ADMIN',
  p_limit integer default 100,
  p_offset integer default 0
) returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or p_workspace not in ('ADMIN','TEACHER') or not private.has_role(p_workspace,true) then raise exception 'staff aal2 required' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then raise exception 'invalid page' using errcode='22023'; end if;
 return query select public.get_placement_projection(c.id) from public.placement_cases c
  where (p_workspace='ADMIN' or private.is_teacher_assigned(c.user_id)) and (p_state is null or c.state=p_state)
  order by c.state_changed_at,c.id limit p_limit offset p_offset;
end $$;
create function public.count_placement_queue(p_state text default null, p_workspace text default 'ADMIN')
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or p_workspace not in ('ADMIN','TEACHER') or not private.has_role(p_workspace,true) then raise exception 'staff aal2 required' using errcode='42501'; end if;
 return (select count(*)::integer from public.placement_cases c
  where (p_workspace='ADMIN' or private.is_teacher_assigned(c.user_id)) and (p_state is null or c.state=p_state));
end $$;
revoke all on function public.get_placement_queue(text, text, integer, integer), public.count_placement_queue(text, text) from public, anon;
grant execute on function public.get_placement_queue(text, text, integer, integer), public.count_placement_queue(text, text) to authenticated;
