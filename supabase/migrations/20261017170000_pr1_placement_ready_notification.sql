-- PR1 / Block 1C: persist exactly one in-app notification when the placement review is finalized.
create function private.placement_ready_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'PLACEMENT_READY' and old.state is distinct from 'PLACEMENT_READY' then
    insert into public.notifications(user_id, notification_type, title, body, data, event_key)
    values (new.user_id, 'PLACEMENT_READY', 'Sua avaliação foi concluída',
      'Confirme sua turma para voltar às aulas.', jsonb_build_object('placement_case_id', new.id),
      new.id || ':PLACEMENT_READY')
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.placement_ready_notification() from public, anon, authenticated;
create trigger placement_ready_notify after update of state on public.placement_cases
  for each row execute function private.placement_ready_notification();
