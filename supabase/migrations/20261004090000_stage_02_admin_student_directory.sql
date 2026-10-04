create or replace function public.admin_student_directory(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 50 or p_offset < 0
     or char_length(coalesce(p_query, '')) > 120 then
    raise exception 'invalid directory query' using errcode = '22023';
  end if;

  return query
  select profile.user_id, profile.display_name, profile.created_at
  from public.profiles as profile
  where exists (
    select 1 from public.user_roles as role
    where role.user_id = profile.user_id and role.role = 'STUDENT'
  )
    and (coalesce(p_query, '') = ''
      or profile.display_name ilike '%' || replace(replace(replace(p_query, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%')
  order by profile.display_name, profile.user_id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_student_directory(text, integer, integer) from public, anon;
grant execute on function public.admin_student_directory(text, integer, integer) to authenticated;
