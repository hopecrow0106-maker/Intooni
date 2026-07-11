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
