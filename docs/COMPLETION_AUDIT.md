# INTOONI Completion Audit

Date: 2026-07-11

This document maps the 22 acceptance criteria to evidence collected in the
workspace. It deliberately separates locally verified behavior from changes
that have only been prepared and from production gates that currently fail.

## Status Legend

- `VERIFIED_LOCAL`: implemented and verified in the local website/Collector or
  by a read-only check of the connected service.
- `PREPARED_NOT_APPLIED`: implementation and migration are ready, but the
  production Supabase project has not been changed.
- `FAILED_EXTERNAL_GATE`: the deployed site still serves the old behavior and
  requires a new deployment or domain configuration.

## Acceptance Criteria

| # | Acceptance criterion | Status | Evidence |
|---|---|---|---|
| 1 | Public pages/APIs do not leak internal data | `VERIFIED_LOCAL` | Public artist and magazine queries use explicit DTOs/columns; error responses are sanitized. Tests cover DTO leakage, routes, and error boundaries. The deployed sampled artist page also contained none of the checked internal markers. |
| 2 | Private/archived artists are excluded from pages, APIs, and sitemap | `PREPARED_NOT_APPLIED` | Local server queries and sitemap filter `status='active'` and `show_on_site=true`; tests pass. The production DB still lacks the target status/visibility migration, so production behavior is not certified. |
| 3 | Browsers do not query the raw `artists` source directly | `VERIFIED_LOCAL` | Public UI uses server/public API boundaries; source-guard tests reject public raw-table access and wildcard selects. |
| 4 | Dated `artist_stats` rows accumulate without overwriting history | `PREPARED_NOT_APPLIED` | Migration, Admin dated upsert/delete API, Sheets manual backfill flow, and Collector approved upsert are implemented and tested. Production table/migration is not applied. |
| 5 | Growth values are calculated from stat history | `VERIFIED_LOCAL` | Admin detail logic calculates changes between the latest and previous records plus cumulative change from the earliest record, regardless of collection interval; focused tests pass. Production display remains dependent on criterion 4. |
| 6 | Artist category uses a foreign key | `PREPARED_NOT_APPLIED` | Target schema adds `artists.main_category_id -> categories.id`; backfill and category deletion guard are prepared/tested. Production migration is not applied. |
| 7 | `is_ad` is completely removed | `PREPARED_NOT_APPLIED` | Application use and stale SQL helper were removed; migration 004 resets/removes the feature and migration 006 performs guarded legacy cleanup. The production column remains until migration execution. |
| 8 | `is_hot` is replaced by `is_trending` | `PREPARED_NOT_APPLIED` | Application, Sheet contract, schema, and backfill use `is_trending`; production backfill/cleanup is not applied. |
| 9 | `hidden_tags` is replaced by `search_tags` | `PREPARED_NOT_APPLIED` | Public/Admin/Sheets target paths use `search_tags`; migration backfills normalized values. Production backfill/cleanup is not applied. |
| 10 | Sheets import has preview and validation | `VERIFIED_LOCAL` | Authenticated preview routes and UI classify rows as create/update/no-change/conflict/error and block apply on validation errors. Route and UI tests pass. |
| 11 | Sheets never auto-overwrites Supabase | `VERIFIED_LOCAL` | The management flow is explicit Preview then Apply; absent Sheet rows never delete/archive DB rows. Collector requires per-row approval for real apply, and `--all-success` is dry-run only. |
| 12 | Admin post checks do not emit public analytics events | `VERIFIED_LOCAL` | Admin preview links are untracked; event-wiring tests cover producer boundaries. |
| 13 | Only `artist_click` and `instagram_outbound` metrics remain | `PREPARED_NOT_APPLIED` | All current public producers and normalization code use only these two names; migration normalizes legacy event rows. Existing production rows remain unchanged until migration. |
| 14 | The new ToonBTI route-map implementation is retained | `VERIFIED_LOCAL` | Signed drafts, explicit publication, route validation, public DTO, and public-artist eligibility checks are implemented and tested. |
| 15 | The old ToonBTI implementation is removed | `PREPARED_NOT_APPLIED` | Legacy manager/components/API were removed locally; migration 006 backs up and drops legacy tables/fields after guards pass. Production tables remain until migration. |
| 16 | Canonical URLs always use `https://intooni.com` | `FAILED_EXTERNAL_GATE` | Local canonical helper is fixed. Latest production check found an artist canonical and `og:url` using `https://intooni.vercel.app`. |
| 17 | `www` and Vercel-host URLs permanently redirect | `FAILED_EXTERNAL_GATE` | Middleware is prepared locally. Latest production check returned 200 with no `Location` for both hosts instead of 307/308. |
| 18 | Sitemap contains canonical URLs only | `VERIFIED_LOCAL` | Local sitemap tests pass; latest live read returned 154 URLs under `https://intooni.com`. |
| 19 | Home initial HTML contains artist detail links | `FAILED_EXTERNAL_GATE` | Local SSR readback contains 255 `/artists/` links. Latest production initial HTML contained none. |
| 20 | UTF-8/NFC is preserved across the project and data flow | `VERIFIED_LOCAL` | Website encoding audit passes and Collector verifies a real Korean XLSX write/read NFC round trip. Live DB server encoding and a populated DB-Sheets-Collector round trip were not available, so those remain residual checks. |
| 21 | Lint, typecheck, tests, and production build pass | `VERIFIED_LOCAL` | `npm.cmd run verify` passed: typecheck, 31 test files/120 tests, encoding audit, lint with no warnings, and Next.js production build. Collector `npm.cmd run verify` also passed. |
| 22 | Migrations reproduce the target from a fresh local database | `PREPARED_NOT_APPLIED` | A legacy baseline plus ordered migrations 001-006 and structural migration tests are present. An actual `supabase db reset` was not run because a local Supabase CLI/Docker database was unavailable. |

## Connected Google Sheet Readback

Read-only verification of spreadsheet
`1tFaqt6mlU7bht6qTR5Z_MKbcoKN-Z86LuHrrNCoaTg8` confirmed the exact headers for
all seven management tabs and all six `collector_*` tabs. Header counts were:

| Tab | Columns |
|---|---:|
| `categories` | 4 |
| `brand_categories` | 4 |
| `artists` | 22 |
| `artist_stats` | 4 |
| `artist_contacts` | 4 |
| `artist_collaborations` | 14 |
| `artist_b2b_profiles` | 6 |
| `collector_records` | 19 |
| `collector_latest` | 22 |
| `collector_failures` | 12 |
| `collector_top5` | 13 |
| `collector_apply_log` | 15 |
| `collector_ignored_failures` | 7 |

The checked ranges contained no data rows. This proves the live header contract,
not a populated-data import/export round trip. No Sheet write was performed in
this audit.

## External Completion Gates

The following actions need operator approval and production credentials:

1. Back up production Supabase, apply migrations `000` through `007` in order,
   and reconcile backfill row counts and RLS behavior.
2. Regenerate database types against the migrated project and rerun the full
   local verification suite.
3. Commit and push the reviewed workspace changes, deploy them, and configure
   `intooni.com` as the Vercel primary domain with the documented environment
   variables.
4. Run `npm.cmd run verify:production` until every redirect, canonical, OG,
   sitemap, initial-link, and leakage gate passes.
5. Run an approved, reversible populated-data Sheet/Collector round trip and
   verify Korean text and stat history in Supabase.

No production migration, Sheet write, commit, push, or deployment was performed
as part of this audit.
