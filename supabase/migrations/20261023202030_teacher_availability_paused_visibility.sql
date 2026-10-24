-- Preserve legacy active-interval visibility, without exposing paused working hours.
drop policy teacher_availability_authenticated_select on public.teacher_availability;
create policy teacher_availability_authenticated_select on public.teacher_availability for select to authenticated
using (
 (active and exists(select 1 from public.teachers t where t.id=teacher_availability.teacher_id and t.active))
 or (private.has_role('TEACHER',true) and exists(select 1 from public.teachers t where t.id=teacher_availability.teacher_id and t.user_id=(select auth.uid()) and t.active))
 or private.has_role('ADMIN',true)
);
