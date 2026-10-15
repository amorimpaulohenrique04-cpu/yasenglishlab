-- ADR 0023: future entitlement versions only; no price or booking mutation.
create function public.admin_plan_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_content_admin();
  return jsonb_build_object(
    'generatedAt',now(),
    'plans',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,'active',p.active) order by p.code) from public.plans p),'[]'::jsonb),
    'entitlements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'key',e.key,'description',e.description,'unit',e.unit,'active',e.active) order by e.key) from public.entitlements e),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'planId',v.plan_id,'entitlementId',v.entitlement_id,'limitValue',v.limit_value,'cadence',v.cadence,'effectiveFrom',v.effective_from,'effectiveTo',v.effective_to) order by v.plan_id,v.entitlement_id,v.effective_from) from public.plan_entitlements v where v.effective_to is null or v.effective_to>now()),'[]'::jsonb));
end $$;

create function public.admin_plan_set_entitlement(p_plan_id uuid,p_entitlement_id uuid,
  p_limit numeric,p_cadence text,p_effective_from timestamptz,p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan public.plans; entitlement public.entitlements; prior public.plan_entitlements;
  same_time public.plan_entitlements; version_id uuid;
begin
  perform private.assert_content_admin();
  if p_plan_id is null or p_entitlement_id is null or p_limit is null or p_limit<0
    or p_limit>99999999 or p_limit<>trunc(p_limit)
    or p_cadence is null or p_cadence not in ('WEEK','MONTH','NONE')
    or p_effective_from is null or not isfinite(p_effective_from)
    or jsonb_typeof(p_context) is distinct from 'object' then
    raise exception 'Invalid entitlement version' using errcode='23514';
  end if;
  -- One writer per plan, including the absent entitlement-row case.
  select * into plan from public.plans where id=p_plan_id for update;
  if not found or not plan.active then raise exception 'Active plan required' using errcode='23514'; end if;
  select * into entitlement from public.entitlements where id=p_entitlement_id for share;
  if not found or not entitlement.active then raise exception 'Active entitlement required' using errcode='23514'; end if;
  if entitlement.unit='BOOLEAN' and (p_limit not in (0,1) or p_cadence<>'NONE') then
    raise exception 'Boolean entitlement requires zero or one and NONE cadence' using errcode='23514';
  end if;
  select * into same_time from public.plan_entitlements where plan_id=p_plan_id
    and entitlement_id=p_entitlement_id and effective_from=p_effective_from;
  if found then
    if row(same_time.limit_value,same_time.cadence) is distinct from row(p_limit,p_cadence) then
      raise exception 'Conflicting entitlement version' using errcode='23514';
    end if;
    -- Exact retry remains idempotent even after its effective date.
    return jsonb_build_object('versionId',same_time.id,'changed',false);
  end if;
  if p_effective_from<now() then raise exception 'Future effective date required' using errcode='23514'; end if;
  select * into prior from public.plan_entitlements where plan_id=p_plan_id
    and entitlement_id=p_entitlement_id and effective_to is null for update;
  if found then
    if p_effective_from<=prior.effective_from then
      raise exception 'Schedule after the latest version' using errcode='23514';
    end if;
    update public.plan_entitlements set effective_to=p_effective_from where id=prior.id;
  elsif exists(select 1 from public.plan_entitlements where plan_id=p_plan_id and entitlement_id=p_entitlement_id
    and (effective_from>=p_effective_from or effective_to>p_effective_from)) then
    raise exception 'Overlapping entitlement history' using errcode='23514';
  end if;
  insert into public.plan_entitlements(plan_id,entitlement_id,limit_value,cadence,effective_from)
    values(p_plan_id,p_entitlement_id,p_limit,p_cadence,p_effective_from) returning id into version_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
    values(auth.uid(),'entitlement_change','plan_entitlements',version_id,
      jsonb_build_object('plan_id',p_plan_id,'entitlement_id',p_entitlement_id,'previous_version_id',prior.id,
        'limit_value',p_limit,'cadence',p_cadence,'effective_from',p_effective_from),
      coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),
      left(coalesce(nullif(p_context->>'environment',''),'unknown'),40),
      left(coalesce(nullif(p_context->>'version',''),'unknown'),120));
  return jsonb_build_object('versionId',version_id,'changed',true);
end $$;
revoke all on function public.admin_plan_list(),public.admin_plan_set_entitlement(uuid,uuid,numeric,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.admin_plan_list(),public.admin_plan_set_entitlement(uuid,uuid,numeric,text,timestamptz,jsonb) to authenticated;
notify pgrst,'reload schema';
