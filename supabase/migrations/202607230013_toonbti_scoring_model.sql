-- Add the normalized four-axis Toon-BTI scoring model.
-- The legacy route-map tables remain intact so existing drafts are never discarded.

alter table public.toon_tests
  add column if not exists description text not null default '',
  add column if not exists intro_image_url text,
  add column if not exists start_button_label text not null default '테스트 시작하기',
  add column if not exists share_text text not null default '',
  add column if not exists is_active boolean not null default false;

create table if not exists public.toonbti_axes (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  name text not null,
  position integer not null check (position >= 0),
  tie_break_trait_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, test_id),
  unique (test_id, position)
);

create table if not exists public.toonbti_traits (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  axis_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9]$'),
  name text not null,
  description text not null default '',
  position integer not null check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, axis_id),
  unique (test_id, code),
  unique (axis_id, position),
  foreign key (axis_id, test_id)
    references public.toonbti_axes(id, test_id) on delete cascade
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'toonbti_axes_tie_break_trait_same_axis_fk'
  ) then
    alter table public.toonbti_axes
      add constraint toonbti_axes_tie_break_trait_same_axis_fk
      foreign key (tie_break_trait_id, id)
      references public.toonbti_traits(id, axis_id)
      deferrable initially deferred;
  end if;
end
$$;

create table if not exists public.toonbti_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  axis_id uuid not null,
  question_text text not null,
  position integer not null check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, axis_id),
  unique (test_id, position),
  foreign key (axis_id, test_id)
    references public.toonbti_axes(id, test_id) on delete cascade
);

create table if not exists public.toonbti_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  axis_id uuid not null,
  trait_id uuid not null,
  option_text text not null,
  score integer not null check (score in (5, 10)),
  position integer not null check (position between 0 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position),
  foreign key (question_id, axis_id)
    references public.toonbti_questions(id, axis_id) on delete cascade,
  foreign key (trait_id, axis_id)
    references public.toonbti_traits(id, axis_id) on delete restrict
);

create table if not exists public.toonbti_result_types (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{4}$'),
  name text not null,
  short_description text not null default '',
  long_description text not null default '',
  image_url text,
  share_image_url text,
  keywords text[] not null default '{}',
  share_text text not null default '',
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, test_id),
  unique (test_id, code)
);

create table if not exists public.artist_toonbti_types (
  artist_id uuid not null references public.artists(id) on delete cascade,
  test_id uuid not null references public.toon_tests(id) on delete cascade,
  result_type_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (artist_id, test_id),
  foreign key (result_type_id, test_id)
    references public.toonbti_result_types(id, test_id) on delete cascade
);

create table if not exists public.toonbti_events (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.toon_tests(id) on delete set null,
  event_type text not null check (
    event_type in (
      'toonbti_start',
      'toonbti_answer',
      'toonbti_complete',
      'toonbti_result_share',
      'toonbti_image_save',
      'toonbti_artist_click',
      'toonbti_instagram_outbound',
      'toonbti_restart'
    )
  ),
  result_code text,
  question_id uuid references public.toonbti_questions(id) on delete set null,
  artist_id uuid references public.artists(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists toonbti_axes_test_position_idx
  on public.toonbti_axes(test_id, position);
create index if not exists toonbti_traits_axis_position_idx
  on public.toonbti_traits(axis_id, position);
create index if not exists toonbti_questions_test_position_idx
  on public.toonbti_questions(test_id, position);
create index if not exists toonbti_question_options_question_position_idx
  on public.toonbti_question_options(question_id, position);
create index if not exists toonbti_result_types_test_position_idx
  on public.toonbti_result_types(test_id, position);
create index if not exists artist_toonbti_types_result_idx
  on public.artist_toonbti_types(result_type_id);
create index if not exists toonbti_events_created_idx
  on public.toonbti_events(created_at desc);

drop trigger if exists set_toonbti_axes_updated_at on public.toonbti_axes;
create trigger set_toonbti_axes_updated_at
before update on public.toonbti_axes
for each row execute function public.set_updated_at();

drop trigger if exists set_toonbti_traits_updated_at on public.toonbti_traits;
create trigger set_toonbti_traits_updated_at
before update on public.toonbti_traits
for each row execute function public.set_updated_at();

drop trigger if exists set_toonbti_questions_updated_at on public.toonbti_questions;
create trigger set_toonbti_questions_updated_at
before update on public.toonbti_questions
for each row execute function public.set_updated_at();

drop trigger if exists set_toonbti_question_options_updated_at on public.toonbti_question_options;
create trigger set_toonbti_question_options_updated_at
before update on public.toonbti_question_options
for each row execute function public.set_updated_at();

drop trigger if exists set_toonbti_result_types_updated_at on public.toonbti_result_types;
create trigger set_toonbti_result_types_updated_at
before update on public.toonbti_result_types
for each row execute function public.set_updated_at();

drop trigger if exists set_artist_toonbti_types_updated_at on public.artist_toonbti_types;
create trigger set_artist_toonbti_types_updated_at
before update on public.artist_toonbti_types
for each row execute function public.set_updated_at();

alter table public.toonbti_axes enable row level security;
alter table public.toonbti_traits enable row level security;
alter table public.toonbti_questions enable row level security;
alter table public.toonbti_question_options enable row level security;
alter table public.toonbti_result_types enable row level security;
alter table public.artist_toonbti_types enable row level security;
alter table public.toonbti_events enable row level security;

revoke all on public.toonbti_axes from anon, authenticated;
revoke all on public.toonbti_traits from anon, authenticated;
revoke all on public.toonbti_questions from anon, authenticated;
revoke all on public.toonbti_question_options from anon, authenticated;
revoke all on public.toonbti_result_types from anon, authenticated;
revoke all on public.artist_toonbti_types from anon, authenticated;
revoke all on public.toonbti_events from anon, authenticated;

grant select, insert, update, delete on public.toonbti_axes to service_role;
grant select, insert, update, delete on public.toonbti_traits to service_role;
grant select, insert, update, delete on public.toonbti_questions to service_role;
grant select, insert, update, delete on public.toonbti_question_options to service_role;
grant select, insert, update, delete on public.toonbti_result_types to service_role;
grant select, insert, update, delete on public.artist_toonbti_types to service_role;
grant select, insert on public.toonbti_events to service_role;

comment on table public.toonbti_axes is '[TOONBTI] Ordered binary preference axes for a Toon-BTI test.';
comment on table public.toonbti_traits is '[TOONBTI] Two managed traits belonging to each preference axis.';
comment on table public.toonbti_questions is '[TOONBTI] Managed scoring questions attached to one axis.';
comment on table public.toonbti_question_options is '[TOONBTI] Four managed answers that award 5 or 10 points to an axis trait.';
comment on table public.toonbti_result_types is '[TOONBTI] Stable result identities and public result content.';
comment on table public.artist_toonbti_types is '[TOONBTI] One final result-type FK per artist and test.';
comment on table public.toonbti_events is '[TOONBTI] Minimal anonymous product events without answer text.';
