# INTOONI Current Data Audit

작성일: 2026-07-11

> 기준선 문서: 아래 내용은 개편 작업을 시작하기 전 상태를 기록한 감사 스냅샷이다. 현재 구현 결과는 `docs/IMPLEMENTATION_STATUS_REPORT.md`를 기준으로 확인한다.

## 범위

이 문서는 `INTOONI 데이터베이스·Admin·Google Sheets·Instagram Collector·보안·SEO 종합 개편 작업 지시서`의 0단계 사전 점검 결과다. 실제 운영 Supabase 데이터는 아직 변경하지 않았다. 현재 확인 범위는 웹사이트 저장소 `C:\Users\user\Desktop\Instoon`, Collector 폴더 `C:\Users\user\Desktop\Projects Files\intooni_Collect`, 연결된 Google Sheet `intooni_Database`다.

## 저장소 상태

웹사이트 저장소:

- 경로: `C:\Users\user\Desktop\Instoon`
- 브랜치: `main`
- `git status --short`: `?? docs/`, `?? intoonismall.png`
- 비고: `docs/`에는 이전 조사 문서가 있고, `intoonismall.png`는 작업자가 만든 것으로 단정하지 않는다. 삭제하거나 되돌리지 않는다.

Collector:

- 경로: `C:\Users\user\Desktop\Projects Files\intooni_Collect`
- `.git`: 없음
- `git status --short`: `fatal: not a git repository`
- `git branch --show-current`: `fatal: not a git repository`
- 비고: git 이력이 없으므로 모든 Collector 변경 전 파일 단위 백업과 변경 목록을 별도로 남겨야 한다.

## Google Sheet 상태

- Spreadsheet ID: `1tFaqt6mlU7bht6qTR5Z_MKbcoKN-Z86LuHrrNCoaTg8`
- 제목: `intooni_Database`
- Locale: `ko_KR`
- Timezone: `Etc/GMT`
- 현재 시트: `시트1`
- 현재 grid: 1000행 x 26열
- 아직 요구 탭(`artists`, `artist_stats`, `collector_latest` 등)은 초기화하지 않았다.

## 현재 DB 스키마 감사

근거: `supabase/schema.sql`

현재 `artists`는 공개 표시, 통계, 검색, 툰비티아이, 내부 메모 성격 데이터가 한 테이블에 혼재한다.

주요 현행 컬럼:

- 기본: `id`, `name`, `instagram_handle`, `genre`, `sort_order`, `created_at`
- 통계 현재값: `followers`, `post_count`
- 통계 증가값: `weekly_follower_growth`, `weekly_post_growth`, `weekly_follower_growth_rate`, `weekly_post_growth_rate`
- 통계 기간: `stats_period_start`, `stats_period_end`, `last_stats_updated_at`
- 검색/태그: `hashtags`, `hidden_tags`, `mood_tags`, `episode_formats`, `style_tags`, `topic_tags`
- 공개/표시: `is_ad`, `is_hot`, `hide_from_new`
- 텍스트/미디어: `memo`, `bio`, `thumbnail_url`, `character_url`, `gallery_post_urls`

현재 `categories`는 `artists.genre`와 FK로 연결되어 있지 않다. `categories.updated_at`도 없다.

현재 `magazines.related_artist_ids`는 `uuid[]`이고 FK가 아니다. 매거진 관련 작가 관계는 별도 join table이 없다.

현재 `artist_event_logs.event_type`는 다음 값을 허용한다.

- `profile_click`
- `instagram_click`
- `embed_click`
- `hero_click`
- `toonbti_result_click`
- `toonbti_character_click`
- `random_click`

현재 ToonBTI 관련 DB 테이블은 `toonbti_question_groups`, `toonbti_question_options`, `artist_toonbti_option_links`가 존재한다. 동시에 관리자에는 localStorage 기반 `ToonbtiRouteMapBuilder`가 존재하므로 새 기능과 레거시가 병존한다.

## RLS 및 권한 감사

근거: `supabase/schema.sql`

현재 `artists`, `categories`, `magazines`, `toonbti_question_groups`, `toonbti_question_options`, `artist_toonbti_option_links`에 anon/authenticated `select` grant가 있다.

현재 다음 공개 RLS 정책이 있다.

- `Public read artists`: `using (true)`
- `Public read categories`: `using (true)`
- `Public read magazines`: `using (true)`
- `Public read toonbti question groups`: `using (true)`
- `Public read toonbti question options`: `using (true)`
- `Public read artist toonbti option links`: `using (true)`

현재 `magazines`에는 `Prototype manage magazines` 정책이 있고 `for all using (true) with check (true)`다. 이 정책은 제거 대상이다.

## 공개 데이터 노출 감사

근거: `rg` 검색 및 주요 파일 확인

공개 또는 공개에 가까운 경로에서 원본 row가 넓게 노출된다.

- `app/page.tsx`: 브라우저 Supabase 클라이언트에서 `artists.select("*")` 사용.
- `app/page.tsx`: `is_ad desc`, `is_hot`, `weekly_*`, `stats_period_*`, `hidden_tags` 직접 사용.
- `app/artists/[id]/page.tsx`: 서버에서 `artists.select("*")` 사용.
- `app/api/artists/route.ts`: `GET`에서 `artists.select("*")` 반환. 인증 없이 호출 가능.
- `app/sitemap.ts`: `artists`를 공개 Supabase client로 조회하며 현재 `show_on_site/status` 필터가 없다.

따라서 다음 값은 현재 공개 JSON, HTML, metadata, hydration payload에 섞일 위험이 있다.

- `memo`
- `hidden_tags`
- `is_ad`
- `is_hot`
- 모든 legacy 통계 컬럼
- 향후 추가될 연락처, B2B, 협업, 리스크 정보

## Admin 감사

근거: `app/admin/page.tsx`, `components/admin/ArtistForm.tsx`, `components/admin/ArtistTable.tsx`, `lib/admin-auth.ts`

현재 관리자 인증은 `lib/admin-auth.ts`에서 쿠키 값이 `"authenticated"`인지 비교한다. HMAC 서명, 만료 payload 검증, 위조 방지가 없다.

현재 관리자 작가 UI는 다음 legacy 필드를 직접 수정한다.

- `is_ad`
- `is_hot`
- `weekly_follower_growth`
- `weekly_post_growth`
- `weekly_follower_growth_rate`
- `weekly_post_growth_rate`
- `hidden_tags`
- `episode_formats`

현재 삭제 흐름은 `/api/artists`의 `DELETE`에서 DB row와 Storage 파일을 실제 삭제한다. 요구사항의 archive 정책과 맞지 않는다.

## ToonBTI 감사

근거: `app/admin/page.tsx`, `components/admin/ToonbtiRouteMapBuilder.tsx`, `components/admin/ToonbtiTagManager.tsx`, `components/admin/ToonbtiManager.tsx`, `app/api/toonbti/route.ts`, `app/toonbti/page.tsx`

현재 관리자 페이지는 `ToonbtiRouteMapBuilder`와 `ToonbtiTagManager`를 렌더링한다. `ToonbtiManager` 파일은 존재하지만 현재 `app/admin/page.tsx`에서 렌더링되지 않는 것으로 확인했다.

현재 공개 `/toonbti`는 `mood_tags`, `episode_formats`, `style_tags`, `topic_tags`를 사용하는 태그 매칭 방식이다. 새 루트맵 기능을 보존하면서 legacy 태그 매칭 및 DB 질문 테이블의 실제 사용 여부를 분리해야 한다.

## SEO 감사

근거: `lib/site.ts`, `app/sitemap.ts`, `app/robots.ts`, `public/robots.txt`

현재 `lib/site.ts`는 `NEXT_PUBLIC_SITE_URL` 다음에 `VERCEL_URL`을 canonical/OG URL fallback으로 사용한다. 운영 canonical 요구사항(`https://intooni.com` 고정)과 충돌한다.

현재 `app/sitemap.ts`는 `SITE_URL = "https://intooni.com"` 상수를 사용하지만 공개 대상 작가 필터가 없다.

현재 `app/robots.ts`와 `public/robots.txt`가 함께 존재한다. 단일 출처로 정리해야 한다.

## Collector 감사

근거: `C:\Users\user\Desktop\Projects Files\intooni_Collect`

주요 파일:

- `IntooniCollector.ps1`: Windows Forms GUI. 버튼 흐름은 `Update New Artists`, `Collect All`, `Sync Failed Handles`, `Retry Failed`, `Remove Selected Failed`, `Apply Approved`.
- `src/export-artists.mjs`: Supabase `artists`에서 `id,name,instagram_handle,followers,post_count`를 읽어 `data/artists.csv`를 생성한다.
- `src/collect.mjs`: CSV 또는 Supabase에서 baseline follower/post를 읽고 Instagram meta를 수집해 `output/instagram-weekly.xlsx`에 `Records`, `Latest`, `Failures`, `Top5`를 작성한다.
- 이전 `src/apply-approved.mjs`는 승인 우회와 legacy `artists` 통계 update 경로가 있었으나, 현재는 승인 행의 `artist_stats` upsert만 허용하고 `--all-success`는 dry-run으로 제한한다.
- `src/retry-failed.mjs`: 실패 행 기준으로 `collect.mjs`를 재실행한다.
- `src/refresh-failed-handles.mjs`: `export-artists.mjs`로 CSV를 갱신한 뒤 실패 행의 handle/url/name을 업데이트한다.
- `src/remove-failure.mjs`: `Latest`/`Failures` 행을 제거하고 `IgnoredFailures`에 기록한다. DB 작가 삭제는 하지 않는다.
- `src/summary.mjs`: CSV와 XLSX의 요약을 JSON으로 출력한다.

현재 Collector가 `artists` legacy stats를 읽거나 쓰는 위치:

- `src/export-artists.mjs`: `followers`, `post_count`를 읽어 `current_followers`, `current_posts`로 CSV 작성.
- `src/collect.mjs`: `followers`, `post_count`, `current_followers`, `current_posts`를 baseline으로 읽음.
- `src/collect.mjs`: 이전 XLSX `Records`에서 증감과 Top5 계산.
- `src/apply-approved.mjs`: `artists.followers`, `artists.post_count`, `weekly_follower_growth`, `weekly_post_growth`, `weekly_follower_growth_rate`, `weekly_post_growth_rate`, `stats_period_start`, `stats_period_end`, `last_stats_updated_at`를 update.
- `README.md`: Apply Approved가 legacy weekly 컬럼을 업데이트한다고 문서화.

현재 local data:

- `data/artists.csv`: `id,name,instagram_handle,instagram_url,current_followers,current_posts` 헤더.
- `output/instagram-weekly.xlsx`: 존재.
- `output/instagram-weekly.before-restore-haritoon.xlsx`: 존재.

## 즉시 차단해야 하는 위험

- 공개 API/페이지에서 `select("*")`가 민감 필드까지 함께 내려보낼 수 있다.
- anon/authenticated가 `artists` 원본 테이블을 직접 조회할 수 있다.
- Admin cookie가 고정 문자열이라 위조 가능하다.
- Collector Apply가 공식 통계 이력 없이 현재값/weekly 값만 덮어쓴다.
- `DELETE /api/artists`가 archive가 아니라 실제 삭제를 수행한다.
- `Prototype manage magazines` 정책은 매거진 변경 권한을 넓게 연다.
- 새 ToonBTI 루트맵과 레거시 ToonBTI가 섞여 있어 일괄 삭제가 위험하다.
## 2026-07-11 Update

- `artists.is_ad` remains a legacy column only.
- Public DTO/UI, Admin UI, and `/api/artists` sorting no longer use the paid artist promotion flag.
- Historical audit lines that mention `is_ad desc` describe the pre-refactor state.
