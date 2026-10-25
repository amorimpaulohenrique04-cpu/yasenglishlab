-- Teacher entry workspace: forward the optional formal pedagogical level (level_based_cohorts) to the
-- canonical finalize_placement_review. Additive signature change: p_level is the last, optional argument.
-- Authorization, draft handling and idempotency remain exactly as in teacher_entry_workspace.
drop function public.finalize_teacher_entry(uuid,uuid,text,text,text,integer);
create function public.finalize_teacher_entry(p_case_id uuid,p_course_id uuid,p_confidence text,
 p_feedback text,p_notes text,p_revision integer,p_level text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not private.has_role('TEACHER',true) then raise exception 'Teacher aal2 required' using errcode='42501'; end if;
 -- The canonical function verifies assignment, level requirements and conflicting retries as well.
 if not exists(select 1 from public.placement_reviews where placement_case_id=p_case_id) then
  perform public.save_teacher_entry_draft(p_case_id,p_course_id,p_confidence,p_feedback,p_notes,p_revision);
 end if;
 v_id:=public.finalize_placement_review(p_case_id,p_course_id,p_feedback,p_confidence,p_level);
 return v_id;
end $$;
revoke all on function public.finalize_teacher_entry(uuid,uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.finalize_teacher_entry(uuid,uuid,text,text,text,integer,text) to authenticated;
