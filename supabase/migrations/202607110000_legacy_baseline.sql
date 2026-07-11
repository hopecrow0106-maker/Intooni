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
