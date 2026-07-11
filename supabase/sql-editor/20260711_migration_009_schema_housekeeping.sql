-- Paste this file into the Supabase SQL Editor to apply migration 009.
-- Non-destructive: no row writes, column drops, table drops, or truncation.

begin;

create index if not exists artist_stats_recorded_date_idx
on public.artist_stats (recorded_date desc);

create index if not exists artist_collaborations_artist_date_idx
on public.artist_collaborations (
  artist_id,
  collaboration_year desc,
  collaboration_month desc
);

create index if not exists artist_recommended_brand_category_idx
on public.artist_recommended_brand_categories (brand_category_id, artist_id);

create index if not exists sheet_sync_jobs_status_created_idx
on public.sheet_sync_jobs (status, created_at desc);

create index if not exists toon_tests_status_idx
on public.toon_tests (status, updated_at desc);

create index if not exists toon_result_artists_artist_idx
on public.toon_result_artists (artist_id);

comment on table public.categories is
  'Public artist categories. Artists reference one main category through artists.main_category_id.';

comment on table public.artist_stats is
  'Official dated Instagram snapshots. One row per artist and recorded date; growth is calculated between snapshots.';

comment on table public.magazine_artists is
  'Many-to-many relation used to embed and order artists related to each magazine.';

comment on table public.artist_collaborations is
  'Private per-artist brand collaboration history managed by Admin and explicit Sheets import.';

comment on table public.sheet_sync_jobs is
  'Audit log for explicit Google Sheets export, preview, and apply operations. Sheets are not an automatic live database mirror.';

comment on table public.migration_legacy_backup is
  'Private rollback evidence retained after verified legacy cleanup. Not an active application source.';

commit;

-- Read-only confirmation: all six names should be returned.
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'artist_stats_recorded_date_idx',
    'artist_collaborations_artist_date_idx',
    'artist_recommended_brand_category_idx',
    'sheet_sync_jobs_status_created_idx',
    'toon_tests_status_idx',
    'toon_result_artists_artist_idx'
  )
order by indexname;
