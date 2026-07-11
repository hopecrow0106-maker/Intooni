# INTOONI Data Migration Report

Date: 2026-07-11

## Scope

This report summarizes the prepared Supabase data migration path for the INTOONI database refactor. The migrations are committed as SQL files only. They have not been applied to the remote production Supabase project by this workspace run.

## Prepared Migrations

1. `202607110000_legacy_baseline.sql`
   - Recreates the pre-refactor schema idempotently so the full migration chain can run on a fresh local database.

2. `202607110001_db_refactor_additive.sql`
   - Adds additive public/private artist fields.
   - Creates `artist_stats`, contact, brand, B2B, collaboration, magazine relation, and sheet sync tables.
   - Adds indexes, triggers, comments, RLS enablement, and service-role grants.

3. `202607110002_security_rls_lockdown.sql`
   - Revokes anon/authenticated direct access to sensitive artist and ToonBTI source tables.
   - Replaces broad magazine policy with a published-only public read policy.

4. `202607110003_db_refactor_backfill.sql`
   - Backfills categories from legacy `genre`.
   - Backfills `search_tags` from `hidden_tags`.
   - Backfills `is_trending` from `is_hot`.
   - Copies current legacy follower/post values into `artist_stats`.
   - Copies `magazines.related_artist_ids` into `magazine_artists`.
   - Normalizes legacy event names into the new event taxonomy.

5. `202607110004_remove_artist_ad_feature.sql`
   - Resets legacy `artists.is_ad` values to `false`.
   - Drops the old `is_ad desc, sort_order asc` index.
   - Recreates the artist sort index on `sort_order asc`.

6. `202607110005_toon_test_route_map.sql`
   - Creates the new route-map runtime tables: `toon_tests`, `toon_nodes`, `toon_edges`, and `toon_result_artists`.
   - Stores one atomic canonical editor draft while synchronizing queryable node, edge, and result-artist rows.
   - Restricts all direct table access to the service role; published tests are exposed only through the server-side public DTO.

7. `202607110006_verified_legacy_cleanup.sql`
8. `202607110007_add_collaboration_content_summary.sql`
   - Blocks cleanup when category, stats, tags, trending, magazine relations, or published ToonBTI backfills are incomplete.
   - Copies full legacy artist, magazine-relation, and ToonBTI rows into `private.migration_legacy_backup` as JSON.
   - Removes legacy artist/magazine columns and the retired ToonBTI question/option/link tables only after all guards pass.

## Compatibility Notes

- Legacy columns remain in the current production DB until migration `006` is explicitly approved. The prepared target schema is already clean, while migration `006` preserves rollback evidence in `private.migration_legacy_backup`.
- Public reads are routed through server-side DTO APIs and do not expose private fields.
- Admin and Google Sheets flows use service-role server code and explicit import/apply steps.
- Collector apply now writes approved stats to `artist_stats` instead of mutating weekly legacy metric columns.
- `artist_stats` stores only the dated official values and timestamps; Collector run/apply metadata remains in XLSX and apply-log surfaces.
- Contact and B2B tables omit inquiry-link, manager-contact, portfolio, and free-form notes fields that the target data policy forbids collecting.
- The application no longer reads legacy ToonBTI question/option/link tables. Migration `006` backs them up and removes them after the published route-map guard succeeds.

## Manual Application Order

Run the migration files in filename order after backing up production data. Do not skip the additive migration before running the security and backfill migrations.

Recommended checks after applying:

```bash
npm run typecheck
npm run test
npm run encoding:check
npm run lint
npm run build
```

Current local result on 2026-07-11: all commands passed (31 test files / 120 tests), with a clean encoding audit, no ESLint warnings, and a successful production build.

Collector dry-run checks:

```bash
cd "C:\Users\user\Desktop\Projects Files\intooni_Collect"
node src/export-artists.mjs --dry-run
node src/collect.mjs --source csv --limit 3 --dry-run
node src/apply-approved.mjs --dry-run --yes --all-success
node src/sync-google-sheets.mjs --dry-run
```

## Known Deferred Production Work

- Applying the prepared cleanup migration is intentionally deferred until production backup, additive migration, backfill reconciliation, route-map publication, and app deployment checks pass.
- Supabase generated TypeScript database types are not regenerated in this run because a live Supabase CLI/project context was not used.
- Production Supabase migration application and post-apply row-count reconciliation remain manual operator steps.
