-- Read-only report of published content that is not ready for Students. It creates nothing and
-- changes nothing: fix the content in Admin Content, or unpublish it. Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/content-readiness.sql
select kind, id, label, problem from (
  select 'course' as kind, c.id, c.title as label, 'published course without published modules' as problem
  from public.courses c
  where c.active and c.publication_status = 'PUBLISHED'
    and not exists (select 1 from public.modules m where m.course_id = c.id and m.publication_status = 'PUBLISHED')
  union all
  select 'module', m.id, m.title, 'published module without published lessons'
  from public.modules m
  where m.publication_status = 'PUBLISHED'
    and not exists (select 1 from public.lessons l where l.module_id = m.id and l.publication_status = 'PUBLISHED')
  union all
  select 'lesson', l.id, l.title, 'published lesson without published assets'
  from public.lessons l
  where l.publication_status = 'PUBLISHED'
    and not exists (select 1 from public.lesson_assets a where a.lesson_id = l.id and a.publication_status = 'PUBLISHED')
  union all
  select 'lesson_asset', a.id, a.asset_type || ' in ' || l.title, 'published TEXT asset without body'
  from public.lesson_assets a join public.lessons l on l.id = a.lesson_id
  where a.publication_status = 'PUBLISHED' and a.asset_type = 'TEXT'
    and coalesce(btrim(a.content ->> 'body'), '') = ''
  union all
  select 'lesson_asset', a.id, a.asset_type || ' in ' || l.title, 'published PDF/AUDIO/LINK asset without source_url'
  from public.lesson_assets a join public.lessons l on l.id = a.lesson_id
  where a.publication_status = 'PUBLISHED' and a.asset_type in ('PDF', 'AUDIO', 'LINK') and a.source_url is null
  union all
  select 'material', m.id, m.title, 'published material without external_url or storage_path'
  from public.materials m
  where m.publication_status = 'PUBLISHED' and m.active and m.external_url is null and m.storage_path is null
  union all
  select 'practice', p.id, p.title, 'published practice without content'
  from public.practice_activities p
  where p.publication_status = 'PUBLISHED' and p.active and (p.content is null or p.content = '{}'::jsonb)
  union all
  select 'welcome_lesson', l.id, l.title, 'flagged welcome but not published (students cannot open it)'
  from public.lessons l where l.welcome and l.publication_status <> 'PUBLISHED'
  union all
  select 'welcome_material', m.id, m.title, 'flagged welcome but not published or inactive'
  from public.materials m where m.welcome and (m.publication_status <> 'PUBLISHED' or not m.active)
) issues
order by kind, label;
