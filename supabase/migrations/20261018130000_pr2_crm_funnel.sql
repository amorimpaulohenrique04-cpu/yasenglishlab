-- PR2 / Block 2C: CRM funnel with confirmed sales. A lead counts as a confirmed sale only when its linked
-- Student has a subscription whose payment was CONFIRMED by a processed provider event: clicks, the WON
-- stage and the hosted-checkout redirect never count. Counts only: no contact data leaves the database.
create function public.admin_crm_funnel()
returns table(stage text, leads bigint, confirmed_sales bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  return query
  select l.stage, count(*)::bigint,
    count(*) filter (where exists (
      select 1 from public.subscriptions s
      join public.billing_events e on e.subscription_id = s.id
      where s.user_id = l.linked_user_id and e.provider = 'ASAAS' and e.event_type = 'CONFIRMED'
        and e.processed_at is not null and e.processing_error is null
    ))::bigint
  from public.crm_leads l
  group by l.stage
  order by array_position(array['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'], l.stage);
end $$;
revoke all on function public.admin_crm_funnel() from public, anon;
grant execute on function public.admin_crm_funnel() to authenticated;
