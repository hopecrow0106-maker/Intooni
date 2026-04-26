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
  memo text not null default '',
  bio text not null default '',
  style_tags text[] not null default '{}',
  mood_tags text[] not null default '{}',
  topic_tags text[] not null default '{}',
  target_audience_tags text[] not null default '{}',
  thumbnail_url text not null default '',
  character_url text not null default '',
  gallery_post_urls text[] not null default '{}',
  is_ad boolean not null default false,
  is_hot boolean not null default false,
  sort_order integer not null default 0,
  last_stats_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.artists
add column if not exists character_url text not null default '';

alter table public.artists
add column if not exists hidden_tags text[] not null default '{}';

alter table public.artists
add column if not exists memo text not null default '';

alter table public.artists
add column if not exists bio text not null default '';

alter table public.artists
add column if not exists style_tags text[] not null default '{}';

alter table public.artists
add column if not exists mood_tags text[] not null default '{}';

alter table public.artists
add column if not exists topic_tags text[] not null default '{}';

alter table public.artists
add column if not exists target_audience_tags text[] not null default '{}';

alter table public.artists
add column if not exists last_stats_updated_at timestamptz not null default now();

alter table public.artists
add column if not exists is_hot boolean not null default false;

create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tag text not null default '',
  content text not null default '',
  thumbnail_url text not null default '',
  related_artist_ids uuid[] not null default '{}',
  instagram_urls text[] not null default '{}',
  view_count integer not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.artist_event_logs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  event_type text not null check (
    event_type in ('profile_click', 'instagram_click', 'embed_click', 'hero_click')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.search_query_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  created_at timestamptz not null default now()
);

insert into public.categories (name, sort_order)
values
  ('썰툰', 0),
  ('일상툰', 1),
  ('육아툰', 2),
  ('연애툰', 3),
  ('직장툰', 4),
  ('공포툰', 5),
  ('감성툰', 6)
on conflict (name) do nothing;

create index if not exists artists_sort_order_idx on public.artists (is_ad desc, sort_order asc);
create index if not exists artists_name_idx on public.artists (name);
create index if not exists artists_genre_idx on public.artists (genre);
create index if not exists categories_sort_order_idx on public.categories (sort_order asc);
create index if not exists magazines_published_at_idx on public.magazines (published_at desc);
create index if not exists artist_event_logs_artist_created_idx on public.artist_event_logs (artist_id, created_at desc);
create index if not exists artist_event_logs_event_created_idx on public.artist_event_logs (event_type, created_at desc);
create index if not exists search_query_logs_query_created_idx on public.search_query_logs (query, created_at desc);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.artists to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.magazines to anon, authenticated;
grant select on public.artist_event_logs to service_role;
grant select on public.search_query_logs to service_role;
grant select, insert, update, delete on public.artists to service_role;
grant select, insert, update, delete on public.categories to service_role;
grant select, insert, update, delete on public.magazines to service_role;
grant insert, delete on public.artist_event_logs to service_role;
grant insert, delete on public.search_query_logs to service_role;

alter table public.artists enable row level security;
alter table public.categories enable row level security;
alter table public.magazines enable row level security;
alter table public.artist_event_logs enable row level security;
alter table public.search_query_logs enable row level security;

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
