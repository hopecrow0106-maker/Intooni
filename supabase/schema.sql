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
  genre text not null,
  followers integer not null default 0,
  post_count integer not null default 0,
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

alter table public.artists
add column if not exists character_url text not null default '';

alter table public.artists
add column if not exists hidden_tags text[] not null default '{}';

alter table public.artists
add column if not exists mood_tags text[] not null default '{}';

alter table public.artists
add column if not exists episode_formats text[] not null default '{}';

alter table public.artists
add column if not exists style_tags text[] not null default '{}';

alter table public.artists
add column if not exists topic_tags text[] not null default '{}';

alter table public.artists
add column if not exists memo text not null default '';

alter table public.artists
add column if not exists bio text not null default '';

alter table public.artists
add column if not exists last_stats_updated_at timestamptz not null default now();

alter table public.artists
add column if not exists is_hot boolean not null default false;

alter table public.artists
add column if not exists hide_from_new boolean not null default false;

alter table public.artists
drop column if exists target_audience_tags;

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

alter table public.magazines
add column if not exists is_public boolean not null default true;

create table if not exists public.artist_event_logs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'profile_click',
      'instagram_click',
      'embed_click',
      'hero_click',
      'toonbti_result_click',
      'toonbti_character_click',
      'random_click'
    )
  ),
  created_at timestamptz not null default now()
);

alter table public.artist_event_logs
drop constraint if exists artist_event_logs_event_type_check;

alter table public.artist_event_logs
add constraint artist_event_logs_event_type_check
check (
  event_type in (
    'profile_click',
    'instagram_click',
    'embed_click',
    'hero_click',
    'toonbti_result_click',
    'toonbti_character_click',
    'random_click'
  )
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
  selection_mode text not null default 'single' check (selection_mode in ('single', 'multi')),
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

create index if not exists artists_sort_order_idx on public.artists (is_ad desc, sort_order asc);
create index if not exists artists_name_idx on public.artists (name);
create index if not exists artists_genre_idx on public.artists (genre);
create index if not exists categories_sort_order_idx on public.categories (sort_order asc);
create index if not exists magazines_published_at_idx on public.magazines (published_at desc);
create index if not exists artist_event_logs_artist_created_idx on public.artist_event_logs (artist_id, created_at desc);
create index if not exists artist_event_logs_event_created_idx on public.artist_event_logs (event_type, created_at desc);
create index if not exists search_query_logs_query_created_idx on public.search_query_logs (query, created_at desc);
create index if not exists toonbti_question_groups_sort_order_idx on public.toonbti_question_groups (sort_order asc);
create index if not exists toonbti_question_options_group_sort_idx on public.toonbti_question_options (group_id, sort_order asc);
create index if not exists artist_toonbti_option_links_option_idx on public.artist_toonbti_option_links (option_id);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.artists to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.magazines to anon, authenticated;
grant select on public.toonbti_question_groups to anon, authenticated;
grant select on public.toonbti_question_options to anon, authenticated;
grant select on public.artist_toonbti_option_links to anon, authenticated;
grant select on public.artist_event_logs to service_role;
grant select on public.search_query_logs to service_role;
grant select, insert, update, delete on public.artists to service_role;
grant select, insert, update, delete on public.categories to service_role;
grant select, insert, update, delete on public.magazines to service_role;
grant select, insert, update, delete on public.toonbti_question_groups to service_role;
grant select, insert, update, delete on public.toonbti_question_options to service_role;
grant select, insert, update, delete on public.artist_toonbti_option_links to service_role;
grant insert, delete on public.artist_event_logs to service_role;
grant insert, delete on public.search_query_logs to service_role;

alter table public.artists enable row level security;
alter table public.categories enable row level security;
alter table public.magazines enable row level security;
alter table public.artist_event_logs enable row level security;
alter table public.search_query_logs enable row level security;
alter table public.toonbti_question_groups enable row level security;
alter table public.toonbti_question_options enable row level security;
alter table public.artist_toonbti_option_links enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'artists'
      and policyname = 'Public read artists'
  ) then
    create policy "Public read artists"
    on public.artists
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'toonbti_question_groups'
      and policyname = 'Public read toonbti question groups'
  ) then
    create policy "Public read toonbti question groups"
    on public.toonbti_question_groups
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'toonbti_question_options'
      and policyname = 'Public read toonbti question options'
  ) then
    create policy "Public read toonbti question options"
    on public.toonbti_question_options
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'artist_toonbti_option_links'
      and policyname = 'Public read artist toonbti option links'
  ) then
    create policy "Public read artist toonbti option links"
    on public.artist_toonbti_option_links
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Public read categories'
  ) then
    create policy "Public read categories"
    on public.categories
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'magazines'
      and policyname = 'Public read magazines'
  ) then
    create policy "Public read magazines"
    on public.magazines
    for select
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'magazines'
      and policyname = 'Prototype manage magazines'
  ) then
    create policy "Prototype manage magazines"
    on public.magazines
    for all
    using (true)
    with check (true);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('artist-images', 'artist-images', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read artist images'
  ) then
    create policy "Public read artist images"
    on storage.objects
    for select
    using (bucket_id = 'artist-images');
  end if;
end
$$;
