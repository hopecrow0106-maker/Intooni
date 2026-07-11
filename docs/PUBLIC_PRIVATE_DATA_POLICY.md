# INTOONI Public/Private Data Policy

작성일: 2026-07-11

## 원칙

공개 페이지, 공개 API, metadata, sitemap, Open Graph, React hydration payload에는 공개 허용 필드만 포함한다. Supabase 원본 row를 그대로 반환하거나 spread하지 않는다.

## 공개 허용 데이터

`PublicArtistDTO` 기준 허용 필드:

- `id`
- `name`
- `instagram_handle`
- `category`
- `bio`
- `hashtags`
- `search_tags`
- `mood_tags`
- `style_tags`
- `topic_tags`
- `thumbnail_url`
- `character_url`
- `gallery_post_urls`
- `is_trending`
- `hide_from_new`
- `sort_order`
- `created_at`
- `updated_at`
- `stats`

`stats` 허용 필드:

- `followers`
- `post_count`
- `followers_delta`
- `followers_growth_rate`
- `posts_delta`
- `posts_growth_rate`
- `latest_recorded_date`
- `previous_recorded_date`

단, `show_growth_on_site=false`이면 증가값과 증가율은 `null`이어야 한다.

## 공개 금지 데이터

다음 키는 공개 응답/HTML/metadata/sitemap/hydration payload에 포함하면 안 된다.

- `email`
- `dm_available`
- `internal_memo`
- `memo`
- `collaborations`
- `brand_name`
- `recommended_brand_categories`
- `strengths`
- `cautions`
- `brand_safety_grade`
- `risk`
- `show_on_site`
- `show_growth_on_site`
- `status`
- `sheet_sync`
- `is_ad`
  - legacy paid promotion 플래그이며 공개 DTO, 공개 UI, Admin UI, `/api/artists` 정렬에서 사용하지 않는다.

금지 키는 `lib/domain/public-artist.ts`의 `FORBIDDEN_PUBLIC_ARTIST_KEYS`에서 관리한다.

## 현재 적용 상태

적용됨:

- `lib/domain/public-artist.ts`: public DTO mapper와 forbidden-key guard 추가
- `lib/server/public-artists.ts`: server-only public artist query layer 추가
- `GET /api/public/artists`: DTO 목록 반환
- `GET /api/public/artists/[handle]`: DTO 단건 반환
- `app/artists/[id]/page.tsx`: 공개 DTO 기반 상세/metadata로 전환
- `app/page.tsx`: Server Component로 전환하고 public DTO를 초기 props로 전달
- `components/home/HomeClient.tsx`: 기존 홈 UI를 client component로 분리하고 public DTO를 안전한 home artist 형태로 변환
- `app/sitemap.ts`: public DTO list 기반으로 active/show_on_site 작가만 사용
- `app/api/artists/route.ts`: 기존 원본 row 목록 GET을 Admin 인증 뒤에만 허용
- `tests/public-artist.test.ts`: forbidden key와 growth 비공개 테스트
- `tests/public-artists-query.test.ts`: public artist server query가 explicit public columns, `status=active`, `show_on_site=true` 필터를 사용하는지 테스트
- `tests/public-artist-route.test.ts`: public artist API 응답 payload forbidden-key 테스트
- `tests/artist-detail-page-source.test.ts`: public artist detail page가 원본 `artists` 조회나 private field를 참조하지 않는지 테스트
- `tests/sitemap.test.ts`: sitemap이 public artist layer와 canonical URL을 사용하는지 테스트

남음:

- Admin 전용 artist API와 public artist API를 완전히 분리해야 한다.
- Supabase RLS에서 anon/authenticated 원본 read를 차단하는 migration 파일은 추가했지만 운영 DB에는 아직 적용하지 않았다.
- `lib/server/public-artists.ts`에는 migration 적용 전 빌드/런타임을 위한 legacy explicit-column fallback이 있다. 운영 DB에 additive migration을 적용한 뒤 fallback 제거 여부를 검토한다.

관련 migration:

- `supabase/migrations/202607110002_security_rls_lockdown.sql`

## API 규칙

공개 API:

- service-role server query가 원본 테이블을 읽을 수 있다.
- 응답은 반드시 `toPublicArtistDTO()`를 통과해야 한다.
- 응답 직전 `assertNoForbiddenPublicArtistKeys()`로 금지 키를 검사한다.

Admin API:

- `isAdminAuthenticated()`를 통과해야 한다.
- 내부 필드 접근은 Admin API에서만 허용한다.

## 테스트 규칙

필수 테스트:

- public DTO에 금지 키 없음
- `show_growth_on_site=false`이면 growth 값 null
- 비공개 작가가 public API/page/sitemap에서 제외됨
- Admin API 인증 없이 401
- anon Supabase source table 직접 조회 실패

현재 자동화된 테스트:

- `tests/public-artist.test.ts`
- `tests/public-artists-query.test.ts`
- `tests/public-artist-route.test.ts`
- `tests/artist-detail-page-source.test.ts`
- `tests/sitemap.test.ts`
- `tests/admin-auth.test.ts`
- `tests/admin-sheets-routes.test.ts`
- `tests/revalidate-stats-route.test.ts`
- `tests/artist-events.test.ts`
- `tests/supabase-migrations.test.ts`
