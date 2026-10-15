-- Stage 12 / C3: let ADMIN+AAL2 set `audience` (COURSE|COHORTS) through admin_content_save.
-- Additive: only the fixed allowlist of private.content_fields changes. `ASSIGNED` stays teacher-only
-- (check constraint requires created_by_teacher_id), so an Admin save with it is rejected by the database.
create or replace function private.content_fields(p_kind text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
 case p_kind
 when 'courses' then return array['slug','title','description','active'];
 when 'modules' then return array['course_id','position','title','description','audience'];
 when 'lessons' then return array['module_id','position','slug','title','estimated_minutes','audience'];
 when 'lesson_assets' then return array['lesson_id','asset_type','position','source_url','content','metadata','required_entitlement_key'];
 when 'materials' then return array['title','material_type','module_id','lesson_id','external_url','metadata','active','required_entitlement_key','audience'];
 when 'practice_activities' then return array['slug','title','skill','cefr_target','difficulty','estimated_minutes','related_module_id','related_lesson_id','content','active','audience'];
 else raise exception 'Unsupported content entity' using errcode='22023';
 end case;
end $$;
