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
