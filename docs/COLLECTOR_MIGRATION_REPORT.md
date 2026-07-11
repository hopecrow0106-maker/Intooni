# INTOONI Collector Migration Report

작성일: 2026-07-11

## 범위

이번 변경은 Collector의 공식 통계 반영 경로를 legacy `artists` weekly/current 컬럼 update에서 `artist_stats` snapshot upsert로 전환하는 1차 작업이다.

Collector 경로:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect
```

Collector는 git 저장소가 아니므로 변경 전 백업을 먼저 만들었다.

백업 경로:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\backups\2026-07-11-before-artist-stats-refactor
```

백업 대상:

- `IntooniCollector.ps1`
- `package.json`
- `README.md`
- `src/export-artists.mjs`
- `src/collect.mjs`
- `src/apply-approved.mjs`
- `src/retry-failed.mjs`
- `src/refresh-failed-handles.mjs`
- `src/remove-failure.mjs`
- `src/summary.mjs`
- `data/artists.csv`
- `output/instagram-weekly.xlsx`

## 변경 파일

Collector:

- `src/export-artists.mjs`
- `src/collect.mjs`
- `src/apply-approved.mjs`
- `README.md`

웹사이트:

- `app/api/internal/revalidate-stats/route.ts`
- `docs/COLLECTOR_INTEGRATION.md`
- `docs/SEO_DEPLOYMENT_CHECKLIST.md`

## `export-artists.mjs`

변경:

- 새 schema 우선:
  - `artists.status in ('active', 'hidden')`
  - `archived`는 기본 수집 대상에서 제외
  - 최신 `artist_stats`에서 baseline follower/post를 읽음
- migration 적용 전 DB를 위해 legacy fallback 유지:
  - `id, name, instagram_handle, followers, post_count`
  - fallback도 explicit columns만 사용
- `--dry-run` 추가
- CSV 헤더에 `current_recorded_date` 추가

현재 dry-run 결과:

- Supabase query는 현재 운영 DB에 `artists.status`가 없어 legacy fallback으로 실행됨
- `dry-run: would save 151 artists`
- 실제 CSV 파일은 변경하지 않음

## `collect.mjs`

변경:

- `run_id` 생성
- `recorded_date` 생성
- `Records`, `Latest`, `Top5`, `Failures`에 `run_id`, `recorded_date` 기록
- Retry Failed는 기존 실패 행의 `run_id`, `recorded_date`를 가능한 한 보존
- 기존 열 순서를 크게 흔들지 않도록 새 컬럼은 뒤에 추가

현재 dry-run 결과:

```text
node src/collect.mjs --source csv --limit 3 --dry-run
```

- CSV 3명 대상 확인
- 브라우저 수집 미실행
- XLSX 변경 없음

## `apply-approved.mjs`

변경:

- `--dry-run` 추가
- 승인된 success 행만 처리하는 기존 흐름 유지
- `--all-success`는 dry-run에서만 허용하고 실제 Supabase 쓰기에서는 명시적으로 거부
- 더 이상 `artists` legacy stats 컬럼을 update하지 않음
- `artist_stats`에 upsert:
  - conflict target: `artist_id,recorded_date`
  - payload: `artist_id`, `recorded_date`, `followers`, `post_count`
- `run_id`, 수집 시각, 증감값은 XLSX/Sheets apply log에 보존하고 공식 통계 테이블에는 저장하지 않음
- `recorded_date`는 row 값 우선, 없으면 `collected_at`의 Asia/Seoul 날짜를 사용하며 둘 다 없으면 행을 건너뜀
- Apply 성공 후 `COLLECTOR_REVALIDATE_URL`/`COLLECTOR_REVALIDATE_SECRET`이 있으면 웹사이트 revalidate endpoint 호출
- revalidate 실패는 DB rollback 사유가 아니며 `ApplyLog`에 기록
- 기존 ApplyLog가 새 헤더(`recorded_date`)를 갖고 있지 않으면 legacy sheet로 rename 후 새 ApplyLog 생성

현재 dry-run 결과:

```text
node src/apply-approved.mjs --dry-run --yes --all-success
```

- 149개 success 행 처리 시뮬레이션
- DB write 없음
- XLSX write 없음
- 결과: `dry-run=149`, `failed=0`, `skipped=0`
- 검증 스크립트의 한글 XLSX UTF-8/NFC write/read round-trip 통과

## 웹사이트 revalidate endpoint

추가:

```text
POST /api/internal/revalidate-stats
```

보안:

- `COLLECTOR_REVALIDATE_SECRET` 필수
- `Authorization: Bearer ...` 또는 `x-collector-secret` header 허용
- secret 없으면 500
- secret 불일치 시 401

재검증 대상:

- `/`
- `/sitemap.xml`
- 요청 payload의 `handles` 최대 100개에 대해 `/artists/{handle}`

## 아직 남은 작업

- 운영 Supabase에 additive migration 적용
- `artist_stats` 테이블 존재 확인 후 legacy fallback 제거 검토
- Collector Google Sheets `collector_*` 탭 동기화 스크립트 추가
- Retry Failed의 원래 `recorded_date` 보존을 XLSX 기존 row마다 더 엄격하게 검증
- 실제 Apply는 사용자 승인 후 소량으로 테스트
- Collector `.env`에 아래 값 설정:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ARTIST_STATS_TABLE=artist_stats
COLLECTOR_REVALIDATE_URL=https://intooni.com/api/internal/revalidate-stats
COLLECTOR_REVALIDATE_SECRET=
```

## 검증 명령과 결과

웹사이트:

- `npm.cmd run typecheck`: 통과
- `npm.cmd run test`: 통과, 4 files / 19 tests
- `npm.cmd run encoding:check`: 통과
- `npm.cmd run lint`: 통과, warning 0건
- `npm.cmd run build`: 통과

Collector:

- `node --check src/export-artists.mjs`: 통과
- `node --check src/collect.mjs`: 통과
- `node --check src/apply-approved.mjs`: 통과
- `node src/summary.mjs`: 통과
- `node src/export-artists.mjs --dry-run`: 통과, legacy fallback 사용
- `node src/collect.mjs --source csv --limit 3 --dry-run`: 통과
- `node src/apply-approved.mjs --dry-run --yes --all-success`: 통과
- `node src/sync-google-sheets.mjs --dry-run`: 통과

## 2026-07-11 Google Sheets sync update

추가된 Collector 파일:

- `src/sync-google-sheets.mjs`

변경:

- 로컬 `output/instagram-weekly.xlsx`의 `Records`, `Latest`, `Failures`, `Top5`, `ApplyLog`를 Google Sheets `collector_records`, `collector_latest`, `collector_failures`, `collector_top5`, `collector_apply_log`로 동기화한다.
- `--dry-run`은 Google 인증 없이 대상 탭, 행 수, 컬럼 수를 확인한다.
- 오래된 XLSX에 `run_id`, `recorded_date`, `revalidate_status` 같은 신규 헤더가 없으면 Sheets 업로드 값에 빈 컬럼으로 보강한다.
- `IntooniCollector.ps1`에 `Sync Sheets` 버튼을 추가했다.
- `package.json`에 `sync:sheets` script를 추가했다.
- 로컬 XLSX 헤더 순서를 그대로 쓰지 않고 Google Sheet `collector_*` 표준 헤더 순서로 재배열한다.

검증:

```bash
node --check src/sync-google-sheets.mjs
node src/sync-google-sheets.mjs --dry-run
```

현재 dry-run 결과:

- `collector_records`: 157 rows, 19 columns, current legacy XLSX missing `run_id`, `recorded_date`
- `collector_latest`: 149 rows, 22 columns, current legacy XLSX missing `run_id`, `recorded_date`, `previous_recorded_date`, `debug`, `applied_at`, `apply_status`
- `collector_failures`: 0 rows, 12 columns, current legacy XLSX missing `run_id`, `recorded_date`, `collected_at`, `instagram_handle`, `status`, `resolved`, `ignored_reason`
- `collector_top5`: 20 rows, 13 columns, current legacy XLSX missing `run_id`, `recorded_date`
- `collector_apply_log`: 298 rows, 11 columns, current legacy XLSX missing `run_id`, `recorded_date`, `revalidate_status`

## 2026-07-11 Collector workbook header alignment

Additional change:

- `src/collect.mjs` now writes new `Records`, `Latest`, `Failures`, and `Top5` headers in the same order as the live Google Sheets `collector_records`, `collector_latest`, `collector_failures`, and `collector_top5` tabs.
- Legacy `Records` rows are preserved and migrated into the new standard-header `Records` sheet on the next real collection.
- `--failed-date` checks `recorded_date` first and falls back to legacy `collected_at`.
- `src/remove-failure.mjs` now writes `IgnoredFailures` rows with `ignored_at`, `artist_id`, `artist_name`, `instagram_url`, `reason`, `run_id`, and `recorded_date`.
- Legacy ignored-failure rows are preserved in `Ignored_legacy_YYYY-MM-DD` when the local sheet is migrated.
- `src/sync-google-sheets.mjs` now syncs local `IgnoredFailures` to live `collector_ignored_failures`.

Additional verification:

```bash
node --check src/collect.mjs
node --check src/sync-google-sheets.mjs
node src/collect.mjs --source csv --limit 3 --dry-run
node src/apply-approved.mjs --dry-run --yes --all-success
node src/sync-google-sheets.mjs --dry-run
npm run verify
```

Result:

- all commands passed
- `collect.mjs`/`remove-failure.mjs` header constants vs `sync-google-sheets.mjs` target headers: `Records`, `Latest`, `Failures`, `Top5`, and `IgnoredFailures` all match
- current `missingSourceHeaders` in dry-run reflects the existing legacy `output/instagram-weekly.xlsx`; future real collection runs write the standard headers directly
- current legacy `IgnoredFailures` has 5 local headers, so dry-run reports missing `run_id` and `recorded_date` until the next remove/migration action rewrites it
- temp workbook remove-failure migration test passed: new `IgnoredFailures` header is 7 columns and legacy rows are preserved in `Ignored_legacy_YYYY-MM-DD`
- `npm run verify` reports current legacy workbook header status without failing until the next real collection migrates the workbook
