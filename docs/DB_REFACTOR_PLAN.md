# INTOONI DB Refactor Plan

작성일: 2026-07-11

## 목표

Supabase Postgres를 공식 원본으로 유지하되 공개 데이터, 관리자 데이터, 통계 이력, Google Sheets bulk 관리, Instagram Collector 적용 경로를 분리한다. 기존 컬럼은 먼저 보존하고 additive migration으로 새 구조를 만든 뒤, 데이터 검증과 코드 전환이 끝난 후 별도 cleanup migration에서 제거한다.

## 원칙

- 운영 DB에 수동 destructive SQL을 바로 적용하지 않는다.
- 첫 migration은 additive만 수행한다.
- `artists.select("*")`를 공개 코드에서 제거한다.
- 공개 API는 DTO whitelist만 반환한다.
- Google Sheets는 bulk admin 도구이며 실시간 DB나 공식 통계 원본이 아니다.
- Collector의 공식 통계 반영은 `artist_stats` upsert만 허용한다.
- 기존 XLSX, CSV, 실패 이력, legacy 컬럼은 migration 검증 전 삭제하지 않는다.
- 새 ToonBTI 루트맵 기능(`ToonbtiRouteMapBuilder`)은 보존하고 DB 저장/발행 경로에 연결한다.

## 신규/변경 DB 구조

### `categories`

변경:

- `updated_at timestamptz not null default now()` 추가
- `name` unique 유지

후속:

- `artists.main_category_id` FK 대상
- 연결 작가가 있는 카테고리 삭제 차단

### `artists`

Additive migration에서 추가할 컬럼:

- `main_category_id uuid references public.categories(id)`
- `search_tags text[] not null default '{}'`
- `show_on_site boolean not null default true`
- `show_growth_on_site boolean not null default true`
- `is_trending boolean not null default false`
- `status public.artist_status not null default 'active'`
- `internal_memo text not null default ''`
- `updated_at timestamptz not null default now()`

추가 제약:

- `instagram_handle` unique
- normalized lower handle 정책은 API/import에서 강제하고 DB check 또는 trigger를 검토한다.

cleanup migration `202607110006_verified_legacy_cleanup.sql` 제거 대상:

- `genre`
- `followers`
- `post_count`
- `weekly_follower_growth`
- `weekly_post_growth`
- `weekly_follower_growth_rate`
- `weekly_post_growth_rate`
- `stats_period_start`
- `stats_period_end`
- `last_stats_updated_at`
- `is_ad`
- `is_hot`
- `hidden_tags`
- `episode_formats`
- `avg_likes`가 존재한다면 제거
- `memo`는 공개 사용 여부 확인 후 `internal_memo`로 전환한다.

### `artist_stats`

신규 테이블:

- `id uuid primary key default gen_random_uuid()`
- `artist_id uuid not null references public.artists(id) on delete restrict`
- `recorded_date date not null`
- `followers integer not null check (followers >= 0)`
- `post_count integer not null check (post_count >= 0)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

제약/인덱스:

- `unique (artist_id, recorded_date)`
- `(artist_id, recorded_date desc)` index

증감값은 저장하지 않고 public/admin query layer에서 계산한다. 이전 기록이 없으면 growth는 `null`이다.

### 내부 관리 테이블

가능하면 Phase 2에서 모두 생성한다.

- `artist_contacts`
- `brand_categories`
- `artist_recommended_brand_categories`
- `artist_b2b_profiles`
- `artist_collaborations`
- `magazine_artists`
- `sheet_sync_jobs`

공통 정책:

- anon/authenticated 직접 read 차단
- service role 또는 server-only admin API만 접근
- public DTO에 절대 포함하지 않음

### Events

목표 display 이벤트:

- `artist_click`
- `instagram_outbound`

마이그레이션:

- `profile_click`, `hero_click`, `random_click`, `toonbti_result_click`, `toonbti_character_click` -> `artist_click`
- `instagram_click`, `embed_click` -> `instagram_outbound`
- Admin에서 대표 게시물 확인하는 클릭은 기록하지 않는다.

### ToonBTI

보존:

- `components/admin/ToonbtiRouteMapBuilder.tsx`

분리/검증 후 제거:

- `components/admin/ToonbtiManager.tsx`
- `components/admin/ToonbtiTagManager.tsx`
- `app/api/toonbti/route.ts`
- legacy DB 질문/옵션/link 테이블
- 공개 `/toonbti`의 legacy 태그 매칭

구현된 신규 schema (`202607110005_toon_test_route_map.sql`):

- `toon_tests`
- `toon_nodes`
- `toon_edges`
- `toon_result_artists`

관리자 편집 원본은 `toon_tests.draft`에 원자적으로 저장하고, 노드/간선/결과 작가 관계를 나머지 세 테이블에 동기화한다. 공개 `/toonbti`는 `published` 상태의 테스트만 읽으며 결과 작가는 공개 작가 필터를 다시 통과한다.

애플리케이션의 `episode_formats` 및 legacy 질문/옵션/link 의존성은 제거했다. 검증·JSON backup·삭제를 원자적으로 수행하는 migration `006`도 준비했으며, 운영에서는 신규 발행 흐름과 backfill 건수를 검증한 뒤에만 적용한다.

## RLS 전환 계획

Phase 2/5에서 수행:

- source table인 `artists`, `artist_stats`, contacts, B2B, collaborations, sheet jobs의 anon/authenticated direct read 차단
- public read는 server API DTO로만 제공
- `Prototype manage magazines` 정책 제거
- public magazine read는 `is_public=true`만 허용하거나 server DTO로 전환
- storage public read는 artist images 범위로 유지 가능하나 upload/delete는 service role만 허용

## Public Data Layer

신규 파일 후보:

- `lib/server/supabase-admin.ts`
- `lib/server/public-artists.ts`
- `lib/server/admin-artists.ts`
- `lib/domain/public-artist.ts`
- `lib/domain/admin-artist.ts`
- `lib/database.types.ts`

신규 public API:

- `GET /api/public/artists`
- `GET /api/public/artists/[handle]`

Public filter:

- `status = 'active'`
- `show_on_site = true`

Public DTO 허용 필드:

- `id`
- `name`
- `instagram_handle`
- `main_category`
- `bio`
- `hashtags`
- `search_tags`
- `mood_tags`, `style_tags`, `topic_tags` 중 공개적으로 필요한 값
- `thumbnail_url`
- `character_url`
- `gallery_post_urls`
- latest `followers`, `post_count`
- growth fields only when `show_growth_on_site = true`

Public DTO 금지 필드:

- `email`
- `dm_available`
- `internal_memo`
- `memo`가 내부로 판정된 경우 `memo`
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

## Google Sheets 연동 계획

환경변수:

- `GOOGLE_SHEETS_ENABLED`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

금지:

- `NEXT_PUBLIC_` prefix 사용
- 브라우저에 credential 전달
- Sheets 변경만으로 자동 DB overwrite

Admin API 후보:

- `POST /api/admin/sheets/export`
- `POST /api/admin/sheets/import/preview`
- `POST /api/admin/sheets/import/apply`
- `GET /api/admin/sheets/jobs`

Preview는 DB를 변경하지 않는다. Apply는 validation 결과와 admin 승인 후에만 실행한다. 시트 행 삭제는 DB 삭제가 아니다.

## Migration 순서

1. `supabase/migrations/*_db_refactor_additive.sql`
   - enum, 컬럼, 새 테이블, FK, unique, indexes, update trigger 추가
   - 기존 컬럼 삭제 없음

2. `supabase/migrations/*_db_refactor_backfill.sql`
   - `genre` -> `main_category_id`
   - `hidden_tags` -> `search_tags`
   - `is_hot` -> `is_trending`
   - 현재 `followers/post_count` -> `artist_stats` 오늘 날짜 또는 명시된 backfill date
   - `related_artist_ids` -> `magazine_artists`
   - 이벤트 타입 매핑
   - 결과 건수 기록용 SQL comment 포함

3. 애플리케이션 전환
   - public DTO/API
   - Admin API/UI
   - Collector `artist_stats` upsert
   - Sheets preview/apply
   - RLS 강화

관련 파일:
- `supabase/migrations/202607110002_security_rls_lockdown.sql`
- `supabase/migrations/202607110003_db_refactor_backfill.sql`
- `supabase/migrations/202607110005_toon_test_route_map.sql`

4. `supabase/migrations/*_db_refactor_cleanup.sql`
   - 전환 검증 후에만 legacy 컬럼/정책/API 제거
   - 구현 파일: `202607110006_verified_legacy_cleanup.sql`

## 검증 기준

- migration만으로 새 로컬 DB 재현 가능
- public API 응답에 금지 키 없음
- 비공개 작가는 API/page/sitemap 404 또는 제외
- anon Supabase로 source table 직접 조회 실패
- `artist_stats` unique `(artist_id, recorded_date)` 작동
- Collector Apply 재실행 시 중복 row 없음
- 기존 XLSX/CSV를 유지한 채 신규 흐름이 동작
- `lint`, `typecheck`, `test`, `build` 통과
## 2026-07-11 Update

- `artists.is_ad` is retained only as a legacy compatibility column.
- The paid artist promotion UI/query path was removed and `202607110004_remove_artist_ad_feature.sql` drops the old `is_ad desc` sort index.
- Fresh-database reproducibility is prepared through `202607110000_legacy_baseline.sql`; static migration tests verify the full `000` through `007` order and cleanup guards. Docker/Supabase CLI was unavailable, so an actual local migration execution remains an operator check.
- The Admin artist surface now includes the required internal stats, contact, collaboration, B2B, and memo management paths plus the required list filters. Normal removal archives an artist; permanent deletion is not exposed in the ordinary UI.
