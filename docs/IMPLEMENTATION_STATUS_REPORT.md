# INTOONI Implementation Status Report

Date: 2026-07-11

This is a working status report for the database, Admin, Google Sheets, Collector, security, SEO, and encoding refactor. It is not a claim that production Supabase or Vercel has been changed.

The criterion-by-criterion final evidence matrix is in `docs/COMPLETION_AUDIT.md`.

## 1. Implemented Summary

- Added a fresh-database legacy baseline, additive Supabase migrations for the target structure, and a guarded cleanup migration that backs up legacy rows before removing retired columns/tables.
- Tightened the prepared target schema so `artist_contacts` and `artist_b2b_profiles` use `artist_id` as their primary key, B2B `strengths`/`cautions` are internal text fields, and collaborations require a valid `collaboration_year`.
- Realigned the Admin Sheets contract to the exact target headers (`artist_id`, category ids, four-column `artist_stats`/`artist_contacts`, fourteen-column collaborations including internal `content_summary`, and six-column B2B profiles). Removed forbidden contact/manager/portfolio/notes fields and non-target run metadata from the prepared DB schema.
- Completed general Admin Sheets import support for categories, brand categories, artists, contacts, collaborations, and B2B profiles. The Admin preview renders row status, identifier, errors, and before/after values; apply is blocked by any validation error or stale conflict. Missing Sheet rows never delete or archive DB rows.
- Added authenticated per-artist Admin APIs and UI tabs for dated stat history/upsert/delete, a follower history chart, tri-state contact data, collaboration history, recommended brand categories, strengths/cautions, and Korean brand-safety controls. The artist list now filters by public state, lifecycle status, growth visibility, trending, category, missing data, contact, collaboration, and B2B presence.
- B2B profile and recommended-category replacement now run atomically through a service-role-only PostgreSQL function shared by Admin UI and Sheets Apply.
- Changed normal artist removal to archive (`status='archived'`, all public visibility off), relabeled the button as `보관`, and added an explicit connected-artist category deletion guard with a 409 response.
- Added an explicit public magazine DTO/query boundary so public list/API reads cannot expose `is_public`, legacy `related_artist_ids`, or future internal magazine columns through wildcard selects.
- Added server-side public artist DTO/API paths and removed public raw `artists.select("*")` usage.
- Hardened Admin session cookies with signed expiring tokens.
- Added Google Sheets Admin export/import preview/apply/job APIs. Export covers all seven management tabs. General preview/apply covers categories, brand categories, artists, contacts, collaborations, and B2B profiles with validation, `CREATE/UPDATE/NO_CHANGE/CONFLICT/ERROR` classification, and stale timestamp protection. `artist_stats` remains a separate explicit manual backfill flow. The Admin panel uses a target selector plus Preview/Apply commands and keeps stats behind its own warning and confirmation.
- Switched public magazine related-artist rendering to use only the `magazine_artists` join table. Admin reads/saves use the relation, with a narrowly scoped missing-table save fallback for the pre-migration production DB.
- Updated Collector to export baselines from `artist_stats`, collect `run_id`/`recorded_date`, write workbook headers aligned with Google Sheets `collector_*` tabs, apply approved rows to `artist_stats`, call optional cache revalidation, and sync local XLSX sheets to Google Sheets `collector_*` tabs.
- Real collection now saves XLSX first and then performs best-effort automatic Google Sheets sync when configured; a Sheets failure leaves the completed XLSX collection intact and can be retried manually.
- Real Apply Approved runs reject `--all-success`; only per-row approved successes can write to Supabase. Collector verification performs a Korean XLSX UTF-8/NFC write/read round trip.
- Updated canonical site URL handling, sitemap, robots, preview noindex, and domain redirects.
- Removed home hydration nondeterminism by keeping the server/client initial artist order, hero decorations, and search examples stable, then randomizing only after mount. Artist cards now include real detail-page links in the interactive DOM as well as the initial HTML.
- Added UTF-8/editor settings and an encoding audit script.
- Added `lib/database.types.ts` for the prepared refactor schema and wired Supabase clients to it.
- Removed the legacy ToonBTI tag manager, question manager, public tag matcher, and `/api/toonbti` source route. The retained route-map builder now loads and saves signed Admin drafts, explicitly publishes a validated version, and the public `/toonbti` page renders only the published DTO with public-eligible artists.
- Standardized public event producers: home/card/random/magazine/ToonBTI artist opens send `artist_click`; public profile and post exits send `instagram_outbound`; Admin Instagram previews remain untracked.
- Publishing rejects cyclic or incomplete route maps, unreachable nodes, result cards without artists, and result artists that are not active and public.
- Added Vitest coverage for admin auth, Admin Sheets route authorization/export/import workflow/UI wiring, explicit manual `artist_stats` import gating, Collector revalidation authorization, public DTO leakage/growth, public artist server query filtering, public artist API route payloads, public artist detail source guards, event normalization, artist sheet parsing, sitemap generation, magazine artist join-table wiring, deployment indexing helpers, Supabase type wiring, and Supabase migration structure/security/backfill guards.

## 2. Key Changed File Groups

- Supabase migrations: `supabase/migrations/202607110000_*` through `202607110007_*`
- Public data layer: `lib/domain/public-artist.ts`, `lib/server/public-artists.ts`, `app/api/public/artists/*`
- Admin Sheets: `lib/server/google-sheets.ts`, `lib/server/admin-sheets.ts`, `lib/sheets/artist-sheet.ts`, `app/api/admin/sheets/*`
- Per-artist Admin internals: `components/admin/ArtistInternalManager.tsx`, `app/api/admin/artists/[id]/*`, `lib/domain/admin-artist-details.ts`
- Collector: `src/export-artists.mjs`, `src/collect.mjs`, `src/apply-approved.mjs`, `src/sync-google-sheets.mjs`, `IntooniCollector.ps1`
- SEO/security/encoding: `lib/site.ts`, `middleware.ts`, `app/robots.ts`, `app/sitemap.ts`, `.editorconfig`, `.gitattributes`, `.vscode/settings.json`, `scripts/audit-encoding.mjs`

## 3. Migration List

- `202607110000_legacy_baseline.sql`
- `202607110001_db_refactor_additive.sql`
- `202607110002_security_rls_lockdown.sql`
- `202607110003_db_refactor_backfill.sql`
- `202607110004_remove_artist_ad_feature.sql`
- `202607110005_toon_test_route_map.sql`
- `202607110006_verified_legacy_cleanup.sql`
- `202607110007_add_collaboration_content_summary.sql`

These files are prepared but were not applied to the remote production Supabase project in this run.

## 4. Data Migration Result

Prepared backfill covers:

- `genre` to `categories`/`main_category_id`
- `hidden_tags` to `search_tags`
- `is_hot` to `is_trending`
- legacy current followers/posts to `artist_stats`
- `magazines.related_artist_ids` to `magazine_artists`
- legacy event names to normalized event names
- `is_ad` reset to `false`

Production row-count reconciliation remains a manual post-migration task.
Runtime public magazine detail rendering uses only `magazine_artists`. The legacy array is referenced only by migration/backfill and the Admin pre-migration save fallback.

## 5. Public/Private Separation

Public responses are routed through `PublicArtistDTO`. Forbidden private/admin keys include `email`, `dm_available`, `memo`, `internal_memo`, collaboration/B2B fields, `show_on_site`, `show_growth_on_site`, `status`, sheet sync metadata, and `is_ad`.

Public card/modal AD badges and public memo rendering were removed. Home search no longer searches `memo`.

The public ToonBTI response is also a whitelist DTO: it excludes editor-only draft configuration and resolves result artists through the same active, `show_on_site` public boundary.

## 6. Google Sheets Flow

Admin flow:

```text
Google Sheets -> Admin preview -> validation -> Admin apply -> Supabase
```

Google Sheets is not a real-time database and does not automatically overwrite Supabase.

Collector flow:

```text
Collector XLSX -> sync-google-sheets.mjs -> collector_* tabs for review
```

`sync-google-sheets.mjs` reorders local XLSX rows into the live Google Sheet `collector_*` header order before writing.

## 7. Collector Data Flow

```text
export-artists.mjs -> data/artists.csv
collect.mjs -> output/instagram-weekly.xlsx
sync-google-sheets.mjs -> collector_* tabs
apply-approved.mjs -> Supabase artist_stats upsert
apply-approved.mjs -> optional /api/internal/revalidate-stats
```

`artist_stats` is the official stats source after approved apply. Google Sheets collector tabs are review/audit copies.

The internal cache revalidation route requires `COLLECTOR_REVALIDATE_SECRET`; unauthorized requests return 401 and do not call `revalidatePath()`.

## 8. SEO Result

- Canonical base URL is `https://intooni.com`.
- `app/robots.ts` is the active robots source.
- `public/robots.txt` was removed.
- `www.intooni.com` and `intooni.vercel.app` are redirected to the canonical host by middleware.
- Preview/non-production deployments send noindex signals through metadata, `robots.txt`, and `X-Robots-Tag`.
- Sitemap uses public artist filtering.

## 9. Encoding Result

`npm run encoding:check` passes and writes `docs/ENCODING_AUDIT_REPORT.md`.

## 10. Verification Commands Run

Website:

```bash
npm.cmd run typecheck
npm.cmd run test
npm.cmd run encoding:check
npm.cmd run lint
npm.cmd run build
```

Final local result after the target schema, Admin internals, atomic B2B writes, strict date and cumulative-history checks, public error boundaries, category guards, magazine relation, event taxonomy, Sheets, Collector, ToonBTI, and hydration changes: all passed. Encoding audit and lint passed with no warnings, and the production build succeeded with all five per-artist Admin routes present.

Run these checks sequentially. Running `typecheck` and `build` at the same time can race on `.next/types` while Next.js regenerates build artifacts. `npm run verify` runs the website checks in the safe order and passed locally on 2026-07-11.

Collector:

```bash
node --check src/sync-google-sheets.mjs
node src/summary.mjs
node src/export-artists.mjs --dry-run
node src/collect.mjs --source csv --limit 3 --dry-run
node src/apply-approved.mjs --dry-run --yes --all-success
node src/sync-google-sheets.mjs --dry-run
npm run verify
```

Result: all passed. Export dry-run used legacy fallback because the current remote DB does not yet have `artists.status`.

## 11. Vercel Manual Tasks

- Set `NEXT_PUBLIC_SITE_URL=https://intooni.com`.
- Set `ADMIN_PASSWORD`.
- Set `ADMIN_SESSION_SECRET`.
- Set Google Sheets service account env vars if Admin Sheets APIs are enabled.
- Set `COLLECTOR_REVALIDATE_SECRET`.
- Confirm Vercel Primary Domain is `intooni.com`.
- Submit `https://intooni.com/sitemap.xml` to Search Console after deployment.

## 12. Supabase Manual Tasks

- Back up production data before applying migrations.
- Apply migrations in filename order.
- Verify `artist_stats` row counts and `magazine_artists` counts after backfill.
- Verify anon/authenticated cannot directly read private/internal source tables.
- Verify service role can perform Admin and Collector operations.

## 13. Google Cloud/Sheets Manual Tasks

- Create or select a service account.
- Share the target spreadsheet with the service account email.
- Set `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS`.
- Run Admin export or Collector sync only after verifying sheet sharing.

## 13-1. Live Google Sheet Readback

Connected Google Sheet checked again on 2026-07-11:

- Spreadsheet title: `intooni_Database`
- Spreadsheet id: `1tFaqt6mlU7bht6qTR5Z_MKbcoKN-Z86LuHrrNCoaTg8`
- The seven management tabs were subsequently realigned to the final exact header contract in `docs/SHEETS_COLUMN_REFERENCE.md`; the target ranges now end at `D`, `D`, `V`, `D`, `D`, `M`, and `F` respectively.
- Readback confirmed the exact final headers, gray bold header formatting, and frozen row 1. The tabs had no data rows at the time of this header migration.
- Readback confirmed frozen header rows and expected visible collector tabs/header order:
  - `collector_latest`
  - `collector_records`
  - `collector_failures`
  - `collector_top5`
  - `collector_apply_log`
  - `collector_ignored_failures`
- Collector sync was adjusted after live readback so local XLSX rows are reordered into the live `collector_*` header order before writing.
- A later live readback found `collector_apply_log` missing four audit-growth columns. The empty tab was expanded and realigned to the final 15-column `ApplyLog` contract (`followers_delta`, both growth rates, and `posts_delta` included), with header format, frozen row, and A:O filter preserved.
- Admin export now selects `categories.updated_at`, resolves `artists.main_category_id` through the category relation for `main_category_name`, and records the configured spreadsheet id in `sheet_sync_jobs`.

## 14. Collector Env Setup

Required:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ARTIST_STATS_TABLE=artist_stats
```

Optional:

```env
COLLECTOR_REVALIDATE_URL=https://intooni.com/api/internal/revalidate-stats
COLLECTOR_REVALIDATE_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=
AUTO_SYNC_GOOGLE_SHEETS=true
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

## 15. Still Open

- Remote Supabase migrations have not been applied by this run.
- Live Google Sheets connector readback was performed, but Admin/Collector live write calls were not executed because service account env/share state must be confirmed by the operator.
- Live production checks were executed on 2026-07-11 and currently fail the deployment gates: `www` and `intooni.vercel.app` return `200` instead of permanent redirects, the artist canonical/OG URL still uses `intooni.vercel.app`, and the home initial HTML lacks artist detail links. A new deployment is required before rechecking.
- Added `npm run verify:production` to repeat redirect, canonical/OG, sitemap, initial-link, and forbidden-marker checks. Its latest run reports five failed gates: both redirects, home SSR links, artist canonical, and artist OG URL. The sampled deployed artist HTML no longer matched the forbidden-marker list.
- Local SSR readback after the hydration fix returned a stable search placeholder across repeated requests and 255 `/artists/*` links in the initial home HTML. The in-app browser had confirmed the original hydration error before the fix, but its webview did not reattach after the local server restart, so a post-fix browser-console capture remains a deployment smoke-test item.
- `lib/database.types.ts` now tracks the prepared refactor schema and is wired into `lib/supabase.ts`. It should still be regenerated from a live local or remote Supabase CLI context after migrations are applied, using `npm run types:supabase:local` or `npm run types:supabase:remote`.
- The guarded cleanup migration is prepared but remains unapplied until production backup, backfill reconciliation, route-map publication, and deployment verification are complete.
- Legacy ToonBTI tables and `artists.episode_formats` are absent from the target schema and application path; migration `006` backs them up and removes them once its production guards pass.

## 16. Rollback

Use `docs/ROLLBACK_PLAN.md`. Migrations `001`-`005` preserve legacy source data except the `is_ad` reset/index replacement. Migration `006` is explicitly destructive, guard-protected, and writes full legacy JSON rows to `private.migration_legacy_backup` before dropping fields/tables.

## 17. 2026-07-11 Collector Header Alignment Addendum

- Live header readback confirmed `categories`, `brand_categories`, `artists`, `artist_stats`, `artist_contacts`, `artist_collaborations`, `artist_b2b_profiles`, and all visible `collector_*` header rows.
- New Collector workbooks write `Records`, `Latest`, `Failures`, and `Top5` headers in the same order as the matching live `collector_*` tabs.
- Existing legacy workbooks may still show `missingSourceHeaders` in dry-run until the next real collection rewrites/migrates the workbook.
- Additional Collector header check passed: `collect.mjs` `Records`, `Latest`, `Failures`, and `Top5` header constants match `sync-google-sheets.mjs` target headers.
- Added Collector `npm run verify` for repeatable header alignment and legacy stats write checks.
- `IgnoredFailures` is now aligned with and synced to `collector_ignored_failures`; current legacy local rows may still miss `run_id` and `recorded_date` until rewritten.
- Temp workbook verification confirmed `remove-failure.mjs` migrates legacy ignored rows into `Ignored_legacy_YYYY-MM-DD` and creates the 7-column standard `IgnoredFailures` sheet.

## 18. 2026-07-11 Collector Dry-Run Check

- `node src/summary.mjs` completed and reported 149 artists in `data/artists.csv`, 149 latest workbook rows, 149 successes, 0 failures, and 0 approved rows.
- `node src/export-artists.mjs --dry-run` completed. It reported that the current remote `artists.status` column is missing and used the legacy-column fallback, confirming remote production migrations are still unapplied.
- `node src/apply-approved.mjs --dry-run` completed with no approved success rows found, so no Supabase write was attempted.
- `node src/sync-google-sheets.mjs --dry-run` completed and mapped the legacy workbook into the target `collector_*` headers while reporting missing legacy source headers that will be blank-filled.
