-- Stage 08: generic guard. No function in schemas public/private may be executable by anon or PUBLIC.
-- proacl IS NULL means the default ACL, which grants EXECUTE to PUBLIC, so it counts as a violation.
-- Extension-owned functions (pg_depend deptype 'e') are out of scope. Read-only; creates nothing.
begin;
do $$
declare
  -- Explicit exceptions, as 'schema.name'. Empty on purpose: add an entry only with a documented public reason.
  allowlist text[] := array[]::text[];
  scanned integer;
  offenders text;
begin
  select count(*) into scanned
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');
  if scanned < 20 then
    raise exception 'function_privileges scanned only % functions; the check would be vacuous', scanned;
  end if;

  select string_agg(
           format('%I.%I(%s) [%s]', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
             concat_ws(',',
               case when p.proacl is null or exists (select 1 from aclexplode(p.proacl) a
                                                     where a.grantee = 0 and a.privilege_type = 'EXECUTE')
                    then 'PUBLIC' end,
               case when has_function_privilege('anon', p.oid, 'EXECUTE') then 'anon' end)),
           E'\n' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
  into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and format('%s.%s', n.nspname, p.proname) <> all (allowlist)
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and (p.proacl is null
         or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
         or has_function_privilege('anon', p.oid, 'EXECUTE'));

  if offenders is not null then
    raise exception E'functions executable by anon/PUBLIC (revoke all on function ... from public, anon):\n%', offenders;
  end if;
end $$;
rollback;
