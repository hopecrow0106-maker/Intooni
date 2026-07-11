-- INTOONI production migration bundle 000-007
-- Generated from supabase/migrations in filename order.
-- Run only after a verified backup. The transaction rolls back on any error.
begin;

-- ============================================================================
-- 202607110000_legacy_baseline.sql
-- ============================================================================
-- Idempotent baseline for fresh local resets and existing production projects.
-- Existing tables/data are preserved; 001+ performs the refactor.

create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instagram_handle text not null,
  genre text not null default '',
  followers integer not null default 0,
  post_count integer not null default 0,
  weekly_follower_growth integer not null default 0,
  weekly_post_growth integer not null default 0,
  weekly_follower_growth_rate numeric not null default 0,
  weekly_post_growth_rate numeric not null default 0,
  stats_period_start date,
  stats_period_end date,
  hashtags text[] not null default '{}',
  hidden_tags text[] not null default '{}',
  mood_tags text[] not null default '{}',
  episode_formats text[] not null default '{}',
  style_tags text[] not null default '{}',
  topic_tags text[] not null default '{}',
  memo text not null default '',
  bio text not null default '',
  thumbnail_url text not null default '',
  character_url text not null default '',
  gallery_post_urls text[] not null default '{}',
  is_ad boolean not null default false,
  is_hot boolean not null default false,
  hide_from_new boolean not null default false,
  sort_order integer not null default 0,
  last_stats_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tag text not null default '',
  content text not null default '',
  thumbnail_url text not null default '',
  related_artist_ids uuid[] not null default '{}',
  instagram_urls text[] not null default '{}',
  view_count integer not null default 0,
  is_public boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.artist_event_logs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  event_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.search_query_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.toonbti_question_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text not null default '',
  selection_mode text not null default 'single',
  max_selections integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.toonbti_question_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.toonbti_question_groups(id) on delete cascade,
  key text not null,
  label text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, key)
);

create table if not exists public.artist_toonbti_option_links (
  artist_id uuid not null references public.artists(id) on delete cascade,
  option_id uuid not null references public.toonbti_question_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artist_id, option_id)
);

alter table public.categories enable row level security;
alter table public.artists enable row level security;
alter table public.magazines enable row level security;
alter table public.artist_event_logs enable row level security;
alter table public.search_query_logs enable row level security;
alter table public.toonbti_question_groups enable row level security;
alter table public.toonbti_question_options enable row level security;
alter table public.artist_toonbti_option_links enable row level security;

-- ============================================================================
-- 202607110001_db_refactor_additive.sql
-- ============================================================================
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'artist_status') then
    create type public.artist_status as enum ('active', 'hidden', 'archived');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_text_array(input_values text[])
returns text[]
language sql
immutable
strict
as $$
  select coalesce(
    array_agg(normalize(btrim(item), NFC) order by ordinality),
    '{}'::text[]
  )
  from unnest(input_values) with ordinality as entries(item, ordinality)
  where btrim(item) <> '';
$$;

create or replace function public.normalize_catalog_name()
returns trigger
language plpgsql
as $$
begin
  new.name = normalize(btrim(new.name), NFC);
  if new.name = '' then
    raise exception 'name must not be empty';
  end if;
  return new;
end;
$$;

create or replace function public.normalize_artist_text()
returns trigger
language plpgsql
as $$
begin
  new.name = normalize(btrim(new.name), NFC);
  new.instagram_handle = lower(normalize(regexp_replace(btrim(new.instagram_handle), '^@', ''), NFC));
  if new.name = '' or new.instagram_handle = '' then
    raise exception 'artist name and instagram_handle must not be empty';
  end if;
  new.bio = normalize(btrim(coalesce(new.bio, '')), NFC);
  new.internal_memo = normalize(btrim(coalesce(new.internal_memo, '')), NFC);
  new.hashtags = public.normalize_text_array(coalesce(new.hashtags, '{}'::text[]));
  new.search_tags = public.normalize_text_array(coalesce(new.search_tags, '{}'::text[]));
  new.mood_tags = public.normalize_text_array(coalesce(new.mood_tags, '{}'::text[]));
  new.style_tags = public.normalize_text_array(coalesce(new.style_tags, '{}'::text[]));
  new.topic_tags = public.normalize_text_array(coalesce(new.topic_tags, '{}'::text[]));
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.categories
    group by normalize(btrim(name), NFC)
    having count(*) > 1
  ) then
    raise exception 'categories contain duplicate names after NFC/trim normalization';
  end if;
end
$$;

update public.categories
set name = normalize(btrim(name), NFC)
where name is distinct from normalize(btrim(name), NFC);

create unique index if not exists categories_name_nfc_unique_idx
on public.categories (normalize(btrim(name), NFC));

alter table public.categories
add column if not exists updated_at timestamptz not null default now();

alter table public.artists
add column if not exists main_category_id uuid references public.categories(id) on delete restrict,
add column if not exists search_tags text[] not null default '{}',
add column if not exists show_on_site boolean not null default true,
add column if not exists show_growth_on_site boolean not null default true,
add column if not exists is_trending boolean not null default false,
add column if not exists status public.artist_status not null default 'active',
add column if not exists internal_memo text not null default '',
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists normalize_categories_name on public.categories;
create trigger normalize_categories_name
before insert or update of name on public.categories
for each row execute function public.normalize_catalog_name();

drop trigger if exists normalize_artists_text on public.artists;
create trigger normalize_artists_text
before insert or update
on public.artists
for each row execute function public.normalize_artist_text();

update public.artists
set search_tags = hidden_tags
where search_tags = '{}'
  and hidden_tags is not null
  and array_length(hidden_tags, 1) is not null;

update public.artists
set is_trending = is_hot
where is_trending = false
  and is_hot = true;

do $$
begin
  if exists (
    select 1
    from public.artists
    group by lower(normalize(regexp_replace(btrim(instagram_handle), '^@', ''), NFC))
    having count(*) > 1
  ) then
    raise exception 'artists contain duplicate instagram_handle values after normalization';
  end if;
end
$$;

update public.artists
set name = name;

create unique index if not exists artists_instagram_handle_unique_idx
on public.artists (lower(trim(leading '@' from instagram_handle)));

create index if not exists artists_main_category_idx on public.artists (main_category_id);
create index if not exists artists_public_visibility_idx on public.artists (status, show_on_site, sort_order);
create index if not exists artists_is_trending_idx on public.artists (is_trending) where is_trending = true;

create table if not exists public.artist_stats (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  recorded_date date not null,
  followers integer not null check (followers >= 0),
  post_count integer not null check (post_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, recorded_date)
);

create index if not exists artist_stats_artist_recorded_idx
on public.artist_stats (artist_id, recorded_date desc);

create table if not exists public.artist_contacts (
  artist_id uuid primary key references public.artists(id) on delete restrict,
  email text,
  dm_available boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from public.brand_categories
    group by normalize(btrim(name), NFC)
    having count(*) > 1
  ) then
    raise exception 'brand_categories contain duplicate names after NFC/trim normalization';
  end if;
end
$$;

update public.brand_categories
set name = normalize(btrim(name), NFC)
where name is distinct from normalize(btrim(name), NFC);

create unique index if not exists brand_categories_name_nfc_unique_idx
on public.brand_categories (normalize(btrim(name), NFC));

drop trigger if exists normalize_brand_categories_name on public.brand_categories;
create trigger normalize_brand_categories_name
before insert or update of name on public.brand_categories
for each row execute function public.normalize_catalog_name();

create table if not exists public.artist_recommended_brand_categories (
  artist_id uuid not null references public.artists(id) on delete restrict,
  brand_category_id uuid not null references public.brand_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (artist_id, brand_category_id)
);

create table if not exists public.artist_b2b_profiles (
  artist_id uuid primary key references public.artists(id) on delete restrict,
  strengths text not null default '',
  cautions text not null default '',
  brand_safety_grade text check (brand_safety_grade is null or brand_safety_grade in ('unknown', 'safe', 'normal', 'caution')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_collaborations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete restrict,
  brand_name text not null,
  brand_category_id uuid references public.brand_categories(id) on delete set null,
  collaboration_year smallint not null,
  collaboration_month smallint,
  post_url text not null,
  content_summary text not null default '',
  ad_disclosure_status text not null default 'unknown',
  likes integer check (likes is null or likes >= 0),
  comments integer check (comments is null or comments >= 0),
  views bigint check (views is null or views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (collaboration_year >= 2000),
  check (collaboration_month is null or collaboration_month between 1 and 12),
  check (ad_disclosure_status in ('yes', 'no', 'unknown'))
);

create unique index if not exists artist_collaborations_artist_post_url_idx
on public.artist_collaborations (artist_id, post_url);

create table if not exists public.magazine_artists (
  magazine_id uuid not null references public.magazines(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (magazine_id, artist_id)
);

create index if not exists magazine_artists_artist_idx
on public.magazine_artists (artist_id);

create table if not exists public.sheet_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null check (status in ('preview', 'applied', 'failed', 'cancelled')),
  spreadsheet_id text not null,
  sheet_name text,
  requested_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sheet_sync_jobs_created_idx
on public.sheet_sync_jobs (created_at desc);

create or replace function public.admin_replace_artist_b2b_profile(
  p_artist_id uuid,
  p_strengths text,
  p_cautions text,
  p_brand_safety_grade text,
  p_brand_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_brand_safety_grade not in ('unknown', 'safe', 'normal', 'caution') then
    raise exception 'invalid brand safety grade';
  end if;

  insert into public.artist_b2b_profiles (
    artist_id,
    strengths,
    cautions,
    brand_safety_grade,
    updated_at
  )
  values (
    p_artist_id,
    coalesce(p_strengths, ''),
    coalesce(p_cautions, ''),
    p_brand_safety_grade,
    now()
  )
  on conflict (artist_id) do update
  set strengths = excluded.strengths,
      cautions = excluded.cautions,
      brand_safety_grade = excluded.brand_safety_grade,
      updated_at = now();

  delete from public.artist_recommended_brand_categories
  where artist_id = p_artist_id;

  insert into public.artist_recommended_brand_categories (artist_id, brand_category_id)
  select p_artist_id, category_id
  from unnest(coalesce(p_brand_category_ids, '{}'::uuid[])) as category_id
  on conflict (artist_id, brand_category_id) do nothing;
end;
$$;

revoke all on function public.admin_replace_artist_b2b_profile(uuid, text, text, text, uuid[])
from public, anon, authenticated;
grant execute on function public.admin_replace_artist_b2b_profile(uuid, text, text, text, uuid[])
to service_role;


drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_artists_updated_at on public.artists;
create trigger set_artists_updated_at
before update on public.artists
for each row execute function public.set_updated_at();

drop trigger if exists set_artist_stats_updated_at on public.artist_stats;
create trigger set_artist_stats_updated_at
before update on public.artist_stats
for each row execute function public.set_updated_at();

drop trigger if exists set_artist_contacts_updated_at on public.artist_contacts;
create trigger set_artist_contacts_updated_at
before update on public.artist_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_brand_categories_updated_at on public.brand_categories;
create trigger set_brand_categories_updated_at
before update on public.brand_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_artist_b2b_profiles_updated_at on public.artist_b2b_profiles;
create trigger set_artist_b2b_profiles_updated_at
before update on public.artist_b2b_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_artist_collaborations_updated_at on public.artist_collaborations;
create trigger set_artist_collaborations_updated_at
before update on public.artist_collaborations
for each row execute function public.set_updated_at();

drop trigger if exists set_sheet_sync_jobs_updated_at on public.sheet_sync_jobs;
create trigger set_sheet_sync_jobs_updated_at
before update on public.sheet_sync_jobs
for each row execute function public.set_updated_at();

alter table public.artist_stats enable row level security;
alter table public.artist_contacts enable row level security;
alter table public.brand_categories enable row level security;
alter table public.artist_recommended_brand_categories enable row level security;
alter table public.artist_b2b_profiles enable row level security;
alter table public.artist_collaborations enable row level security;
alter table public.magazine_artists enable row level security;
alter table public.sheet_sync_jobs enable row level security;

revoke all on public.artist_stats from anon, authenticated;
revoke all on public.artist_contacts from anon, authenticated;
revoke all on public.brand_categories from anon, authenticated;
revoke all on public.artist_recommended_brand_categories from anon, authenticated;
revoke all on public.artist_b2b_profiles from anon, authenticated;
revoke all on public.artist_collaborations from anon, authenticated;
revoke all on public.magazine_artists from anon, authenticated;
revoke all on public.sheet_sync_jobs from anon, authenticated;

grant select, insert, update, delete on public.artist_stats to service_role;
grant select, insert, update, delete on public.artist_contacts to service_role;
grant select, insert, update, delete on public.brand_categories to service_role;
grant select, insert, update, delete on public.artist_recommended_brand_categories to service_role;
grant select, insert, update, delete on public.artist_b2b_profiles to service_role;
grant select, insert, update, delete on public.artist_collaborations to service_role;
grant select, insert, update, delete on public.magazine_artists to service_role;
grant select, insert, update, delete on public.sheet_sync_jobs to service_role;

comment on column public.artists.search_tags is 'Public search keywords migrated from hidden_tags. Use for general search.';
comment on column public.artists.internal_memo is 'Private admin memo. Do not expose through public API, HTML, metadata, sitemap, or hydration.';
comment on table public.artist_stats is 'Official dated Instagram stats snapshots. Growth is calculated at read time, not stored here.';
comment on table public.sheet_sync_jobs is 'Audit log for explicit Google Sheets preview/apply jobs. Sheets edits are not automatic DB sync.';

alter table public.artist_event_logs
drop constraint if exists artist_event_logs_event_type_check;

alter table public.artist_event_logs
add constraint artist_event_logs_event_type_check
check (
  event_type in (
    'artist_click',
    'instagram_outbound',
    'profile_click',
    'instagram_click',
    'embed_click',
    'hero_click',
    'toonbti_result_click',
    'toonbti_character_click',
    'random_click'
  )
);

-- ============================================================================
-- 202607110002_security_rls_lockdown.sql
-- ============================================================================
-- Security lockdown after public pages move to server-side DTO APIs.
-- This migration does not drop legacy columns or data.

revoke all on public.artists from anon, authenticated;
revoke all on public.artist_stats from anon, authenticated;
revoke all on public.artist_contacts from anon, authenticated;
revoke all on public.brand_categories from anon, authenticated;
revoke all on public.artist_recommended_brand_categories from anon, authenticated;
revoke all on public.artist_b2b_profiles from anon, authenticated;
revoke all on public.artist_collaborations from anon, authenticated;
revoke all on public.magazine_artists from anon, authenticated;
revoke all on public.sheet_sync_jobs from anon, authenticated;

drop policy if exists "Public read artists" on public.artists;
drop policy if exists "Prototype manage magazines" on public.magazines;

drop policy if exists "Public read artist toonbti option links" on public.artist_toonbti_option_links;
drop policy if exists "Public read toonbti question groups" on public.toonbti_question_groups;
drop policy if exists "Public read toonbti question options" on public.toonbti_question_options;

revoke all on public.artist_toonbti_option_links from anon, authenticated;
revoke all on public.toonbti_question_groups from anon, authenticated;
revoke all on public.toonbti_question_options from anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'magazines'
      and policyname = 'Public read published magazines'
  ) then
    create policy "Public read published magazines"
    on public.magazines
    for select
    to anon, authenticated
    using (is_public = true);
  end if;
end
$$;

grant select on public.categories to anon, authenticated;
grant select on public.magazines to anon, authenticated;

grant select, insert, update, delete on public.artists to service_role;
grant select, insert, update, delete on public.artist_stats to service_role;
grant select, insert, update, delete on public.artist_contacts to service_role;
grant select, insert, update, delete on public.brand_categories to service_role;
grant select, insert, update, delete on public.artist_recommended_brand_categories to service_role;
grant select, insert, update, delete on public.artist_b2b_profiles to service_role;
grant select, insert, update, delete on public.artist_collaborations to service_role;
grant select, insert, update, delete on public.magazine_artists to service_role;
grant select, insert, update, delete on public.sheet_sync_jobs to service_role;
grant select, insert, update, delete on public.toonbti_question_groups to service_role;
grant select, insert, update, delete on public.toonbti_question_options to service_role;
grant select, insert, update, delete on public.artist_toonbti_option_links to service_role;

comment on table public.artists is 'Source table locked from anon/authenticated direct reads. Public artist data is served through server DTO APIs.';
comment on table public.artist_stats is 'Official dated stats snapshots. Locked from anon/authenticated direct reads.';

-- ============================================================================
-- 202607110003_db_refactor_backfill.sql
-- ============================================================================
-- Backfill data into the additive refactor schema.
-- This migration preserves all legacy columns and source data.

insert into public.categories (name, sort_order)
select distinct nullif(normalize(btrim(genre), NFC), ''), 0
from public.artists
where nullif(normalize(btrim(genre), NFC), '') is not null
on conflict (name) do nothing;

update public.artists artist
set main_category_id = category.id
from public.categories category
where artist.main_category_id is null
  and category.name = normalize(btrim(artist.genre), NFC);

update public.artists
set search_tags = public.normalize_text_array(hidden_tags)
where (search_tags is null or search_tags = '{}')
  and hidden_tags is not null
  and array_length(hidden_tags, 1) is not null;

update public.artists
set is_trending = is_hot
where is_hot = true
  and is_trending = false;

insert into public.artist_stats (
  artist_id,
  recorded_date,
  followers,
  post_count
)
select
  id,
  coalesce(last_stats_updated_at::date, current_date),
  greatest(coalesce(followers, 0), 0),
  greatest(coalesce(post_count, 0), 0)
from public.artists
where followers is not null
  and post_count is not null
on conflict (artist_id, recorded_date) do update
set
  followers = excluded.followers,
  post_count = excluded.post_count,
  updated_at = now();

insert into public.magazine_artists (magazine_id, artist_id, sort_order)
select
  magazine.id,
  related_artist_id,
  related_artist.ordinality - 1
from public.magazines magazine
cross join lateral unnest(magazine.related_artist_ids) with ordinality as related_artist(related_artist_id, ordinality)
where exists (
  select 1
  from public.artists artist
  where artist.id = related_artist.related_artist_id
)
on conflict (magazine_id, artist_id) do update
set sort_order = excluded.sort_order;

update public.artist_event_logs
set event_type = case
  when event_type in ('instagram_click', 'embed_click') then 'instagram_outbound'
  else 'artist_click'
end
where event_type in (
  'profile_click',
  'instagram_click',
  'embed_click',
  'hero_click',
  'toonbti_result_click',
  'toonbti_character_click',
  'random_click'
);

do $$
declare
  category_count integer;
  artist_category_count integer;
  search_tag_count integer;
  stat_count integer;
  magazine_artist_count integer;
begin
  select count(*) into category_count from public.categories;
  select count(*) into artist_category_count from public.artists where main_category_id is not null;
  select count(*) into search_tag_count from public.artists where array_length(search_tags, 1) is not null;
  select count(*) into stat_count from public.artist_stats;
  select count(*) into magazine_artist_count from public.magazine_artists;

  raise notice 'Backfill summary: categories=%, artists_with_category=%, artists_with_search_tags=%, legacy_stats=%, magazine_artists=%',
    category_count,
    artist_category_count,
    search_tag_count,
    stat_count,
    magazine_artist_count;
end
$$;

-- ============================================================================
-- 202607110004_remove_artist_ad_feature.sql
-- ============================================================================
-- Remove the paid artist promotion ranking path while keeping the legacy
-- artists.is_ad column for rollback and older data compatibility.

drop index if exists public.artists_sort_order_idx;

update public.artists
set is_ad = false
where is_ad = true;

create index if not exists artists_sort_order_idx on public.artists (sort_order asc);

-- ============================================================================
-- 202607110005_toon_test_route_map.sql
-- ============================================================================
-- Persist the new question/result route-map editor without dropping legacy tables.

create table if not exists public.toon_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1 check (version >= 1),
  start_node_key text not null default '',
  draft jsonb not null default '{"startNodeId":"","nodes":[],"options":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toon_nodes (
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  node_key text not null,
  node_type text not null check (node_type in ('question', 'result')),
  title text not null,
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (test_id, node_key)
);

create table if not exists public.toon_edges (
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  edge_key text not null,
  from_node_key text not null,
  to_node_key text not null,
  option_label text not null,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (test_id, edge_key),
  foreign key (test_id, from_node_key)
    references public.toon_nodes(test_id, node_key) on delete cascade,
  foreign key (test_id, to_node_key)
    references public.toon_nodes(test_id, node_key) on delete cascade
);

create table if not exists public.toon_result_artists (
  test_id uuid not null,
  result_node_key text not null,
  artist_id uuid not null references public.artists(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (test_id, result_node_key, artist_id),
  foreign key (test_id, result_node_key)
    references public.toon_nodes(test_id, node_key) on delete cascade
);

create index if not exists toon_tests_status_idx on public.toon_tests (status, updated_at desc);
create index if not exists toon_result_artists_artist_idx on public.toon_result_artists (artist_id);

drop trigger if exists set_toon_tests_updated_at on public.toon_tests;
create trigger set_toon_tests_updated_at
before update on public.toon_tests
for each row execute function public.set_updated_at();

drop trigger if exists set_toon_nodes_updated_at on public.toon_nodes;
create trigger set_toon_nodes_updated_at
before update on public.toon_nodes
for each row execute function public.set_updated_at();

drop trigger if exists set_toon_edges_updated_at on public.toon_edges;
create trigger set_toon_edges_updated_at
before update on public.toon_edges
for each row execute function public.set_updated_at();

alter table public.toon_tests enable row level security;
alter table public.toon_nodes enable row level security;
alter table public.toon_edges enable row level security;
alter table public.toon_result_artists enable row level security;

revoke all on public.toon_tests from anon, authenticated;
revoke all on public.toon_nodes from anon, authenticated;
revoke all on public.toon_edges from anon, authenticated;
revoke all on public.toon_result_artists from anon, authenticated;

grant select, insert, update, delete on public.toon_tests to service_role;
grant select, insert, update, delete on public.toon_nodes to service_role;
grant select, insert, update, delete on public.toon_edges to service_role;
grant select, insert, update, delete on public.toon_result_artists to service_role;

comment on table public.toon_tests is 'New question/result route-map tests. Read publicly only through a server DTO.';
comment on column public.toon_tests.draft is 'Atomic canonical editor payload; normalized node/edge/result tables are synchronized by the Admin API.';

-- ============================================================================
-- 202607110006_verified_legacy_cleanup.sql
-- ============================================================================
-- Destructive finalization. Apply only after 001-005, backup, Admin/public smoke tests,
-- and a published new ToonBTI route map. Guards abort before any drop when migration
-- evidence is incomplete. Source values are copied to a private JSON backup table.

create table if not exists public.migration_legacy_backup (
  scope text not null,
  row_key text not null,
  payload jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (scope, row_key)
);

alter table public.migration_legacy_backup enable row level security;
revoke all on public.migration_legacy_backup from anon, authenticated;
grant select, insert, update, delete on public.migration_legacy_backup to service_role;

do $$
begin
  if exists (
    select 1
    from public.artists
    where nullif(normalize(btrim(genre), NFC), '') is not null
      and main_category_id is null
  ) then
    raise exception 'cleanup blocked: non-empty legacy genre remains without main_category_id';
  end if;

  if exists (
    select 1
    from public.artists artist
    where not exists (
      select 1 from public.artist_stats stat where stat.artist_id = artist.id
    )
  ) then
    raise exception 'cleanup blocked: at least one artist has no artist_stats snapshot';
  end if;

  if exists (
    select 1
    from public.artists
    where not (
      public.normalize_text_array(coalesce(search_tags, '{}'::text[]))
      @> public.normalize_text_array(coalesce(hidden_tags, '{}'::text[]))
    )
  ) then
    raise exception 'cleanup blocked: hidden_tags values are not preserved in search_tags';
  end if;

  if exists (
    select 1
    from public.artists
    where is_hot = true and is_trending = false
  ) then
    raise exception 'cleanup blocked: is_hot values are not preserved in is_trending';
  end if;

  if exists (
    select 1
    from public.magazines magazine
    cross join lateral unnest(magazine.related_artist_ids) as legacy(artist_id)
    where exists (select 1 from public.artists where id = legacy.artist_id)
      and not exists (
        select 1
        from public.magazine_artists relation
        where relation.magazine_id = magazine.id
          and relation.artist_id = legacy.artist_id
      )
  ) then
    raise exception 'cleanup blocked: magazine related_artist_ids are not fully migrated';
  end if;

  if (
    exists (select 1 from public.toonbti_question_groups)
    or exists (select 1 from public.toonbti_question_options)
    or exists (select 1 from public.artist_toonbti_option_links)
  ) and not exists (
    select 1 from public.toon_tests where status = 'published'
  ) then
    raise exception 'cleanup blocked: publish the new ToonBTI route map before dropping legacy data';
  end if;
end
$$;

update public.artists
set internal_memo = normalize(btrim(memo), NFC)
where nullif(btrim(memo), '') is not null
  and nullif(btrim(internal_memo), '') is null;

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'artists_legacy_columns', id::text, to_jsonb(artist)
from public.artists artist
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'magazines_related_artist_ids', id::text, to_jsonb(magazine)
from public.magazines magazine
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'toonbti_question_groups', id::text, to_jsonb(source)
from public.toonbti_question_groups source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'toonbti_question_options', id::text, to_jsonb(source)
from public.toonbti_question_options source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select
  'artist_toonbti_option_links',
  artist_id::text || ':' || option_id::text,
  to_jsonb(source)
from public.artist_toonbti_option_links source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

alter table public.artists
  drop column if exists genre,
  drop column if exists followers,
  drop column if exists post_count,
  drop column if exists weekly_follower_growth,
  drop column if exists weekly_post_growth,
  drop column if exists weekly_follower_growth_rate,
  drop column if exists weekly_post_growth_rate,
  drop column if exists stats_period_start,
  drop column if exists stats_period_end,
  drop column if exists last_stats_updated_at,
  drop column if exists is_ad,
  drop column if exists is_hot,
  drop column if exists hidden_tags,
  drop column if exists episode_formats,
  drop column if exists avg_likes,
  drop column if exists memo;

alter table public.magazines
  drop column if exists related_artist_ids;

drop table if exists public.artist_toonbti_option_links;
drop table if exists public.toonbti_question_options;
drop table if exists public.toonbti_question_groups;

comment on table public.migration_legacy_backup is
  'Private rollback evidence captured immediately before verified legacy cleanup.';

-- ============================================================================
-- 202607110007_add_collaboration_content_summary.sql
-- ============================================================================
alter table if exists public.artist_collaborations
add column if not exists content_summary text not null default '';

comment on column public.artist_collaborations.content_summary is
  'Internal summary of the collaboration content. Never exposed through public artist DTOs.';

commit;
