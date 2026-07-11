# INTOONI Collector Integration

작성일: 2026-07-11

## 현재 Collector 구조

경로: `C:\Users\user\Desktop\Projects Files\intooni_Collect`

Collector는 git 저장소가 아니다. 변경 전 파일 백업과 변경 목록 기록이 필요하다.

현재 사용자 흐름:

1. `Update New Artists`
2. `Collect All`
3. `Sync Failed Handles`
4. `Retry Failed`
5. `Remove Selected Failed`
6. `Apply Approved`

이 흐름은 유지한다.

## 현재 파일 역할

`IntooniCollector.ps1`

- Windows Forms GUI
- `src/export-artists.mjs`, `src/collect.mjs`, `src/refresh-failed-handles.mjs`, `src/retry-failed.mjs`, `src/remove-failure.mjs`, `src/apply-approved.mjs`, `src/summary.mjs`를 호출
- `output/instagram-weekly.xlsx`를 기준으로 Latest/Failures/Approved 상태를 보여줌

`src/export-artists.mjs`

- Supabase `artists`에서 `id`, `name`, `instagram_handle`, `followers`, `post_count`를 읽음
- `data/artists.csv`에 `current_followers`, `current_posts` 작성

`src/collect.mjs`

- `data/artists.csv` 또는 Supabase를 수집 대상 원천으로 사용
- Instagram profile meta에서 followers/posts 수집
- `output/instagram-weekly.xlsx`에 `Records`, `Latest`, `Failures`, `Top5` 작성
- 이전 XLSX record를 baseline으로 growth/top5 계산

`src/apply-approved.mjs`

- 실제 적용은 `Latest.approve_for_update`가 승인된 success 행만 처리하며, `--all-success`는 dry-run 검사 전용
- 현재는 Supabase `artists` 테이블의 legacy stats 컬럼을 직접 update

`src/retry-failed.mjs`

- `--failed-latest` 또는 `--failed-date`를 통해 실패 대상만 재수집

`src/refresh-failed-handles.mjs`

- Supabase에서 최신 handle을 CSV로 다시 export
- `Latest`, `Failures`의 실패 행 name/handle/url 갱신

`src/remove-failure.mjs`

- 실패 행을 `Latest`/`Failures`에서 제거
- `IgnoredFailures`에 기록
- DB 작가 삭제 또는 archive는 하지 않음

`src/summary.mjs`

- GUI용 summary JSON 출력

## 현재 legacy 의존성

읽기:

- `src/export-artists.mjs`: `artists.followers`, `artists.post_count`
- `src/collect.mjs`: `current_followers`, `current_posts`, `followers`, `post_count`
- `src/collect.mjs`: 이전 XLSX `Records` 기준 growth 계산

쓰기:

- `src/apply-approved.mjs`: `artists.followers`
- `src/apply-approved.mjs`: `artists.post_count`
- `src/apply-approved.mjs`: `artists.weekly_follower_growth`
- `src/apply-approved.mjs`: `artists.weekly_post_growth`
- `src/apply-approved.mjs`: `artists.weekly_follower_growth_rate`
- `src/apply-approved.mjs`: `artists.weekly_post_growth_rate`
- `src/apply-approved.mjs`: `artists.stats_period_start`
- `src/apply-approved.mjs`: `artists.stats_period_end`
- `src/apply-approved.mjs`: `artists.last_stats_updated_at`

문서:

- `README.md`도 legacy weekly 컬럼 update를 공식 흐름으로 설명한다.

## 목표 데이터 흐름

공식 흐름:

```text
Admin/Supabase artists
  -> Collector Update New Artists
  -> data/artists.csv
  -> Collect All
  -> output/instagram-weekly.xlsx
  -> Google Sheets collector_* tabs
  -> Apply Approved
  -> Supabase artist_stats upsert
  -> website/admin revalidate
```

원칙:

- XLSX 저장이 먼저다.
- Google Sheets sync 실패는 수집 성공 결과를 폐기하지 않는다.
- Apply 전에는 `artist_stats`를 변경하지 않는다.
- Apply는 승인된 success row만 반영한다.
- `--all-success`는 `--dry-run`에서만 허용되며 실제 쓰기 실행에서는 오류로 중단한다.
- 같은 `artist_id + recorded_date`는 upsert로 중복 생성하지 않는다.
- 이전 공식 통계가 없으면 growth는 `null`이지 `0`이 아니다.
- Apply 시 현재 날짜로 `recorded_date`를 바꾸지 않는다.
- 원래 `recorded_date`와 유효한 legacy `collected_at`이 모두 없으면 해당 행을 건너뛰며 Apply 날짜를 대신 쓰지 않는다.
- `GOOGLE_SHEETS_SPREADSHEET_ID`가 설정된 실제 수집은 XLSX 저장 후 Sheets sync를 자동 시도한다.
- `AUTO_SYNC_GOOGLE_SHEETS=false`로 자동 시도를 끌 수 있으며 GUI `Sync Sheets`로 수동 재시도할 수 있다.

## 신규 Collector 컬럼

`Records`, `Latest`, `collector_records`, `collector_latest` 공통 권장 컬럼:

- `run_id`
- `recorded_date`
- `collected_at`
- `artist_id`
- `artist_name`
- `instagram_handle`
- `instagram_url`
- `followers`
- `posts`
- `previous_recorded_date`
- `previous_followers`
- `previous_posts`
- `followers_delta`
- `followers_growth_rate`
- `posts_delta`
- `posts_growth_rate`
- `status`
- `error_message`
- `debug`
- `approve_for_update`
- `applied_at`
- `apply_status`

`recorded_date`:

- Collect All 시작 시 Asia/Seoul 날짜로 생성
- Retry Failed는 원래 행의 `run_id`, `recorded_date` 보존

`run_id`:

- Collect All 시작 시 생성
- Retry Failed는 원래 run_id 보존 또는 `retry_of_run_id`를 별도 기록

## Supabase 읽기 변경

`Update New Artists`는 더 이상 `artists.followers`, `artists.post_count`를 기준 공식 stats로 읽지 않는다.

대상 작가:

- `status in ('active', 'hidden')`
- `archived` 제외
- `show_on_site=false`도 수집 대상에 포함
- `show_growth_on_site`는 수집 대상 여부에 영향을 주지 않음

baseline:

- `artist_stats`의 최신 공식 기록에서 `followers`, `post_count`, `recorded_date`를 읽는다.
- 없으면 baseline은 `null`로 둔다.

## Supabase 쓰기 변경

`Apply Approved`는 다음만 수행한다.

- `artist_stats` upsert
- conflict target: `(artist_id, recorded_date)`
- DB payload는 `artist_id`, `recorded_date`, `followers`, `post_count`만 저장
- run_id와 수집 시각은 XLSX/Sheets apply log에 보존
- 성공/실패를 XLSX `ApplyLog`와 Sheets `collector_apply_log`에 기록
- 성공 후 보안 revalidate endpoint 호출

더 이상 쓰지 않는 컬럼:

- `artists.followers`
- `artists.post_count`
- `artists.weekly_follower_growth`
- `artists.weekly_post_growth`
- `artists.weekly_follower_growth_rate`
- `artists.weekly_post_growth_rate`
- `artists.stats_period_start`
- `artists.stats_period_end`
- `artists.last_stats_updated_at`

## Google Sheets collector 탭

Collector가 동기화할 탭:

- `collector_latest`
- `collector_records`
- `collector_failures`
- `collector_top5`
- `collector_apply_log`
- `collector_ignored_failures`

주의:

- 이 탭들은 검토와 운영 편의를 위한 보조 뷰다.
- `collector_*` 탭 편집만으로 DB가 자동 변경되면 안 된다.
- Apply는 Collector의 승인 로직 또는 Admin 승인 API를 거쳐야 한다.

## Revalidate endpoint

웹사이트에 추가할 endpoint:

- `POST /api/internal/revalidate-stats`

보안:

- `COLLECTOR_REVALIDATE_SECRET` 필수
- secret 누락 시 endpoint는 실패해야 한다.
- 인증 없는 공개 호출 금지
- `Authorization: Bearer {COLLECTOR_REVALIDATE_SECRET}` 또는 `x-collector-secret` header 사용

실패 처리:

- `artist_stats` upsert 성공 후 revalidate 실패는 DB rollback 사유가 아니다.
- `ApplyLog`에 warning을 남긴다.

현재 적용:

- `app/api/internal/revalidate-stats/route.ts` 추가
- `/`, `/sitemap.xml`, 최대 100개 작가 상세 path를 재검증
- Collector `src/apply-approved.mjs`에서 Apply 성공 후 선택적으로 호출

## 2026-07-11 1차 적용 결과

적용:

- `src/export-artists.mjs`가 `artist_stats` 최신 snapshot을 baseline으로 읽도록 변경
- `src/collect.mjs`가 `run_id`, `recorded_date`를 XLSX에 기록하도록 변경
- `src/apply-approved.mjs`가 `artist_stats` upsert를 수행하도록 변경
- Collector 변경 전 백업 생성

자세한 결과:

- `docs/COLLECTOR_MIGRATION_REPORT.md`

## 변경 전 백업

Collector는 git repo가 아니므로 변경 전 다음 파일을 백업한다.

- `IntooniCollector.ps1`
- `src/export-artists.mjs`
- `src/collect.mjs`
- `src/apply-approved.mjs`
- `src/retry-failed.mjs`
- `src/refresh-failed-handles.mjs`
- `src/remove-failure.mjs`
- `src/summary.mjs`
- `README.md`
- `data/artists.csv`
- `output/instagram-weekly.xlsx`

백업 폴더 예:

```text
backups/2026-07-11-before-artist-stats-refactor/
```

## 검증 명령

Collector:

```bash
node src/summary.mjs
node src/export-artists.mjs --dry-run
node src/collect.mjs --source csv --limit 5
node src/apply-approved.mjs --dry-run
node src/sync-google-sheets.mjs --dry-run
```

웹사이트:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

최종 검색:

```bash
rg -n "weekly_|stats_period_|artists\\.(followers|post_count)|followers,\\s*post_count|\\.update\\(\\{[\\s\\S]*weekly_" "C:\\Users\\user\\Desktop\\Projects Files\\intooni_Collect\\src"
```

## 완료 기준

- `Update New Artists`가 `artist_stats` 최신값을 baseline으로 사용
- `Collect All`이 XLSX를 먼저 저장
- Sheets 장애가 XLSX 저장을 실패시키지 않음
- `Apply Approved`가 `artist_stats`만 upsert
- Retry Failed가 원래 `run_id`와 `recorded_date`를 보존
- Remove Selected Failed가 DB 작가를 삭제 또는 archive하지 않음
- Apply 성공 후 revalidate endpoint가 secret으로 호출됨
- 기존 weekly 컬럼 쓰기 참조가 0개

## 2026-07-11 Collector Header Alignment Update

- `npm run verify`는 지정된 한글 표본을 XLSX에 쓰고 다시 읽어 UTF-8 값과 NFC가 동일한지 검증한다.

- Current `src/apply-approved.mjs` upserts approved snapshots into Supabase `artist_stats` by `artist_id, recorded_date`; it does not update legacy `artists` weekly/current stats columns.
- Current `src/collect.mjs` writes new `Records`, `Latest`, `Failures`, and `Top5` workbook headers in the same order as live Google Sheets `collector_records`, `collector_latest`, `collector_failures`, and `collector_top5`.
- On the next real collection, legacy `Records` rows are preserved in `Records_legacy_YYYY-MM-DD` and migrated into a new standard-header `Records` sheet.
- The current on-disk `output/instagram-weekly.xlsx` can still show `missingSourceHeaders` in `src/sync-google-sheets.mjs --dry-run` until a real collection rewrites/migrates the workbook.
