-- Safe metadata-only classification for the Supabase SQL Editor.
-- It changes comments only: no data writes, drops, renames, or relationship changes.

begin;

comment on table public.categories is '[CORE] Public artist categories referenced by artists.main_category_id.';
comment on table public.artists is '[CORE] Canonical artist profile and visibility settings. Public output is served through server DTOs.';
comment on table public.artist_stats is '[CORE] Official dated Instagram snapshots. One row per artist and recorded date.';

comment on table public.artist_contacts is '[BUSINESS] Private artist email and DM availability. Never expose through public DTOs.';
comment on table public.brand_categories is '[BUSINESS] Brand and campaign industry catalog, separate from public artist categories.';
comment on table public.artist_recommended_brand_categories is '[BUSINESS] Many-to-many recommendations between artists and brand categories.';
comment on table public.artist_b2b_profiles is '[BUSINESS] Private per-artist strengths, cautions, and brand safety assessment.';
comment on table public.artist_collaborations is '[BUSINESS] Private per-artist collaboration history with brand, date, link, summary, and performance.';

comment on table public.magazines is '[EDITORIAL] Magazine article content, publication state, media, and view count.';
comment on table public.magazine_artists is '[EDITORIAL] Ordered many-to-many relation for artists embedded in magazine articles.';

comment on table public.toon_tests is '[TOONBTI] Test identity, publication state, version, and canonical editor draft.';
comment on table public.toon_nodes is '[TOONBTI] Question and result nodes belonging to a ToonBTI test.';
comment on table public.toon_edges is '[TOONBTI] Directed option routes between ToonBTI nodes.';
comment on table public.toon_result_artists is '[TOONBTI] Ordered artist recommendations attached to result nodes.';

comment on table public.artist_event_logs is '[ANALYTICS] Append-only artist and Instagram interaction events.';
comment on table public.search_query_logs is '[ANALYTICS] Append-only public search query events.';

comment on table public.sheet_sync_jobs is '[OPS] Audit log for explicit Google Sheets export, preview, and apply operations.';
comment on table public.migration_legacy_backup is '[OPS] Private rollback evidence retained after legacy cleanup; not an active application source.';

commit;

-- Read-only confirmation. Every public table should show one domain prefix.
select
  table_name,
  obj_description(format('public.%I', table_name)::regclass, 'pg_class') as domain_description
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by
  split_part(coalesce(obj_description(format('public.%I', table_name)::regclass, 'pg_class'), '[UNCLASSIFIED]'), ']', 1),
  table_name;
