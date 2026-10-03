-- P21.6: LessonAsset is pedagogical truth; provider state is private infrastructure.
create table public.lesson_video_assets (
 id uuid primary key default gen_random_uuid(),lesson_asset_id uuid not null unique references public.lesson_assets(id) on delete cascade,
 provider text not null default 'MUX' check(provider='MUX'), provider_upload_id text unique,provider_asset_id text unique,provider_playback_id text,
 processing_status text not null default 'AWAITING_UPLOAD' check(processing_status in ('AWAITING_UPLOAD','UPLOADING','PROCESSING','READY','ERRORED')),
 duration_seconds numeric check(duration_seconds>0),aspect_ratio text,caption_language text not null default 'en' check(length(caption_language) between 2 and 16),
 caption_status text not null default 'NOT_REQUESTED' check(caption_status in ('NOT_REQUESTED','PROCESSING','READY','ERRORED')),
 thumbnail_metadata jsonb not null default '{}',last_provider_error text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),ready_at timestamptz
);
create table public.media_provider_events (
 provider text not null,event_id text not null,event_type text not null,video_asset_id uuid,
 processing_status text not null default 'PENDING' check(processing_status in ('PENDING','PROCESSED','IGNORED')),
 created_at timestamptz not null default now(),processed_at timestamptz,primary key(provider,event_id)
);
alter table public.lesson_video_assets enable row level security;
alter table public.media_provider_events enable row level security;
revoke all on public.lesson_video_assets,public.media_provider_events from public,anon,authenticated;
-- Do not silently alter existing duplicate VIDEO content: preflight fails instead.
create unique index lesson_single_video_v1 on public.lesson_assets(lesson_id) where asset_type='VIDEO';
alter table public.lesson_assets drop constraint lesson_assets_check;
alter table public.lesson_assets add constraint lesson_asset_source_v2 check(asset_type='VIDEO' or num_nonnulls(source_url,storage_path,content)>=1);

create function private.initialize_lesson_video() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.asset_type='VIDEO' then insert into public.lesson_video_assets(lesson_asset_id) values(new.id) on conflict(lesson_asset_id) do nothing; end if;
 return new;
end $$;
create trigger initialize_lesson_video after insert or update of asset_type on public.lesson_assets for each row execute function private.initialize_lesson_video();
insert into public.lesson_video_assets(lesson_asset_id) select id from public.lesson_assets where asset_type='VIDEO';

alter function private.validate_content(text,jsonb) rename to validate_content_pre_video;
create function private.validate_content(p_kind text,p_row jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind='lesson_assets' and p_row->>'asset_type'='VIDEO' then
  if not exists(select 1 from public.lesson_video_assets v where v.lesson_asset_id=(p_row->>'id')::uuid and v.processing_status='READY' and v.provider_playback_id is not null) then raise exception 'READY provider video required' using errcode='23514'; end if;
  if nullif(p_row->>'source_url','') is not null or nullif(p_row->>'storage_path','') is not null then raise exception 'VIDEO uses provider reference' using errcode='23514'; end if;
  -- Delegate shared LessonAsset validation using a local TEXT shape, never persist fake URLs.
  p_row:=jsonb_set(jsonb_set(p_row,'{asset_type}','"TEXT"'),'{content}','{"title":"Video","body":"Provider-backed video","steps":[]}');
 end if;
 perform private.validate_content_pre_video(p_kind,p_row);
end $$;

create function public.prepare_lesson_video_upload(p_asset uuid,p_language text default 'en') returns jsonb language plpgsql security definer set search_path='' as $$
declare video public.lesson_video_assets;
begin
 perform private.assert_content_admin();
 perform 1 from public.lesson_assets where id=p_asset and asset_type='VIDEO' and publication_status='DRAFT' for update;
 if not found then raise exception 'Draft VIDEO required' using errcode='42501'; end if;
 select * into video from public.lesson_video_assets where lesson_asset_id=p_asset for update;
 if video.provider_upload_id is not null or video.processing_status not in ('AWAITING_UPLOAD','ERRORED') then raise exception 'Upload already initiated' using errcode='23514'; end if;
 update public.lesson_video_assets set caption_language=p_language,caption_status='PROCESSING',processing_status='UPLOADING',updated_at=now() where id=video.id;
 return jsonb_build_object('id',video.id,'captionLanguage',p_language);
end $$;

create function public.authorize_lesson_video_playback(p_asset uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role('STUDENT',false) and private.can_read_lesson_asset(p_asset) and exists(select 1 from public.lesson_assets a join public.lesson_video_assets v on v.lesson_asset_id=a.id where a.id=p_asset and a.publication_status='PUBLISHED' and private.content_visible('lesson_assets',a.id) and v.processing_status='READY');
$$;

create function public.process_mux_provider_event(p_event_id text,p_event_type text,p_video_id uuid,p_upload_id text,p_asset_id text,p_playback_id text default null,p_duration numeric default null,p_aspect_ratio text default null)
returns text language plpgsql security definer set search_path='' as $$
declare video public.lesson_video_assets; event public.media_provider_events;
begin
 -- Only server service role after SDK signature validation can execute.
 insert into public.media_provider_events(provider,event_id,event_type,video_asset_id) values('MUX',p_event_id,p_event_type,p_video_id) on conflict do nothing;
 select * into event from public.media_provider_events where provider='MUX' and event_id=p_event_id for update;
 if event.processing_status<>'PENDING' then return event.processing_status; end if;
 select * into video from public.lesson_video_assets where id=p_video_id for update;
 if video.id is null or video.provider_upload_id is null then return 'PENDING'; end if;
 if (p_upload_id is not null and p_upload_id<>video.provider_upload_id) or (video.provider_asset_id is not null and p_asset_id is distinct from video.provider_asset_id) then
  update public.media_provider_events set processing_status='IGNORED',processed_at=now() where provider='MUX' and event_id=p_event_id; return 'IGNORED';
 end if;
 if p_event_type='video.upload.asset_created' then
  if video.processing_status in ('AWAITING_UPLOAD','UPLOADING') then update public.lesson_video_assets set provider_asset_id=p_asset_id,processing_status='PROCESSING',updated_at=now() where id=video.id; end if;
 elsif p_event_type='video.asset.ready' then
  if p_playback_id is null or p_duration is null or p_duration<=0 then return 'PENDING'; end if;
  if video.provider_asset_id is null then return 'PENDING'; end if;
  update public.lesson_video_assets set processing_status='READY',provider_playback_id=p_playback_id,duration_seconds=p_duration,aspect_ratio=p_aspect_ratio,ready_at=coalesce(ready_at,now()),updated_at=now(),last_provider_error=null where id=video.id;
 elsif p_event_type='video.asset.errored' then
  if video.processing_status<>'READY' then update public.lesson_video_assets set processing_status='ERRORED',last_provider_error='Provider processing failed',updated_at=now() where id=video.id; end if;
 elsif p_event_type='video.asset.track.ready' then update public.lesson_video_assets set caption_status='READY',updated_at=now() where id=video.id;
 elsif p_event_type='video.asset.track.errored' then update public.lesson_video_assets set caption_status='ERRORED',updated_at=now() where id=video.id and caption_status<>'READY';
 end if;
 update public.media_provider_events set processing_status='PROCESSED',processed_at=now() where provider='MUX' and event_id=p_event_id;
 return 'PROCESSED';
end $$;
revoke all on function private.initialize_lesson_video(),private.validate_content_pre_video(text,jsonb),private.validate_content(text,jsonb) from public,anon,authenticated;
revoke all on function public.prepare_lesson_video_upload(uuid,text),public.authorize_lesson_video_playback(uuid) from public,anon,authenticated;
grant execute on function public.prepare_lesson_video_upload(uuid,text),public.authorize_lesson_video_playback(uuid) to authenticated;
revoke all on function public.process_mux_provider_event(text,text,uuid,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.process_mux_provider_event(text,text,uuid,text,text,text,numeric,text) to service_role;

alter table public.product_analytics_events drop constraint product_analytics_events_event_name_check;
alter table public.product_analytics_events add constraint product_analytics_events_event_name_check check(event_name in (
 'signup_completed','login_completed','subscription_started','subscription_upgraded','subscription_downgraded','subscription_cancelled',
 'lesson_started','lesson_progressed','lesson_completed','module_completed','practice_started','practice_completed','material_opened','material_favorited','assessment_started','assessment_completed','live_session_booked','live_session_cancelled','live_session_attended',
 'lesson_video_started','lesson_video_resumed','lesson_video_completed'));
alter function public.track_product_event(text,uuid,jsonb,text) rename to track_product_event_pre_video;
revoke all on function public.track_product_event_pre_video(text,uuid,jsonb,text) from public,anon,authenticated;
create function public.track_product_event(p_event_name text,p_lesson_id uuid default null,p_properties jsonb default '{}',p_idempotency_key text default null) returns void language plpgsql security definer set search_path='' as $$
declare asset uuid;
begin
 if p_event_name not in ('lesson_video_started','lesson_video_resumed','lesson_video_completed') then
  perform public.track_product_event_pre_video(p_event_name,p_lesson_id,p_properties,p_idempotency_key);return;
 end if;
 if jsonb_typeof(p_properties) is distinct from 'object' or (p_properties-'lesson_asset_id')<>'{}'::jsonb or p_idempotency_key is null then raise exception 'Minimized video event required' using errcode='23514'; end if;
 asset:=(p_properties->>'lesson_asset_id')::uuid;
 if not public.authorize_lesson_video_playback(asset) or not exists(select 1 from public.lesson_assets where id=asset and lesson_id=p_lesson_id) then raise exception 'Video event unauthorized' using errcode='42501'; end if;
 if p_event_name='lesson_video_completed' and not exists(select 1 from public.lesson_progress where user_id=auth.uid() and lesson_id=p_lesson_id and completion_percent=100) then raise exception 'Persisted completion required' using errcode='42501'; end if;
 insert into public.product_analytics_events(user_id,event_name,lesson_id,properties,idempotency_key) values(auth.uid(),p_event_name,p_lesson_id,p_properties,p_idempotency_key) on conflict do nothing;
end $$;
revoke all on function public.track_product_event(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.track_product_event(text,uuid,jsonb,text) to authenticated;
