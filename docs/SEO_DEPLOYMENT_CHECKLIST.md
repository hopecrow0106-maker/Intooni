# INTOONI SEO Deployment Checklist

Date: 2026-07-11

## Canonical

Production canonical URL:

```text
https://intooni.com
```

Implemented:

- `lib/site.ts`: `CANONICAL_SITE_URL = "https://intooni.com"`
- `lib/site.ts`: `isProductionDeployment()` controls production vs preview indexing.
- `VERCEL_URL` is not used as a canonical fallback.
- `app/layout.tsx`: uses `getSiteUrl()` for `metadataBase` and Open Graph URLs.
- `app/sitemap.ts`: uses `CANONICAL_SITE_URL`.
- `app/robots.ts`: uses `CANONICAL_SITE_URL` for the production sitemap URL.

## Redirect

Implemented in `middleware.ts`:

- `www.intooni.com` -> `https://intooni.com`
- `intooni.vercel.app` -> `https://intooni.com`
- Path and query string are preserved.
- Redirect status is 308 permanent redirect.

Notes:

- Localhost and Vercel preview hosts are not redirected.
- Vercel preview/non-production responses set `X-Robots-Tag: noindex, nofollow`.

## Robots

Implemented:

- `app/robots.ts` is the single robots source.
- `public/robots.txt` was removed.
- Production: `/admin` and `/api` are disallowed; sitemap is `https://intooni.com/sitemap.xml`.
- Preview/non-production: all paths are disallowed.
- `app/layout.tsx` also emits non-indexing metadata for preview/non-production deployments.

## Sitemap

Implemented:

- `app/sitemap.ts` uses the public artist server layer.
- `listPublicArtists()` applies active/show-on-site filtering.
- Artist URLs use `/artists/{instagram_handle}`.
- `updated_at` is used as `lastModified` when present, with `created_at` fallback.
- `app/page.tsx` is a server component that passes initial public artist DTOs into the home client.
- A `noscript` artist link list is rendered for non-JS crawlers.

## Pre-Deploy Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Current 2026-07-11 local result:

- `lint`: passed with no warnings.
- `typecheck`: passed.
- `test`: passed.
- `build`: passed.

## Production Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `COLLECTOR_REVALIDATE_SECRET`

Notes:

- Do not use `VERCEL_URL` as a canonical fallback.
- Do not add the `NEXT_PUBLIC_` prefix to service role keys.

## Production Follow-Up

- Confirm Vercel Primary Domain is `intooni.com`.
- Submit `https://intooni.com/sitemap.xml` in Search Console after deployment.
- Confirm production pages are indexable and preview deployments are noindexed.

## 2026-07-11 Live Production Audit

The prepared local code is not yet reflected in the current production deployment. Direct HTTP checks returned:

- `https://www.intooni.com/artists/gol_ttol?a=1`: `200`, not a permanent redirect.
- `https://intooni.vercel.app/artists/gol_ttol?a=1`: `200`, not a permanent redirect.
- `https://intooni.com/artists/gol_ttol`: canonical and `og:url` still point to `https://intooni.vercel.app/artists/gol_ttol`.
- `https://intooni.com`: initial HTML did not contain `/artists/...` links.
- The deployed legacy artist detail HTML still rendered the old public `메모` block. The prepared local detail page no longer reads or renders that memo field.
- `https://intooni.com/sitemap.xml` uses the canonical `https://intooni.com` host and includes handle-based artist URLs.

Repeat these checks after deploying the prepared branch. Do not treat the local implementation as production-complete until all failed checks change to the expected results.

Automated post-deploy gate:

```bash
npm run verify:production
```

If the sitemap intentionally has no artist yet, pass a known public detail URL through `PRODUCTION_ARTIST_URL`.
