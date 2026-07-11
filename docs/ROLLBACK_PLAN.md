# INTOONI Rollback Plan

작성일: 2026-07-11

## 목적

DB 개편, 공개 데이터 분리, Google Sheets 연동, Collector 전환 중 문제가 생겼을 때 데이터 손실 없이 이전 상태로 되돌리거나 신규 경로만 비활성화하기 위한 절차다.

## 롤백 원칙

- destructive cleanup migration은 별도 승인 전 실행하지 않는다.
- Phase 2 additive migration은 기존 컬럼과 기존 앱 동작을 보존해야 한다.
- 운영 DB에 적용한 사실이 없는 migration은 적용했다고 보고하지 않는다.
- Collector의 local XLSX, CSV, failure history는 삭제하지 않는다.
- Google Sheets import/apply는 job log와 preview 결과가 있어야만 실행한다.
- 코드 롤백과 DB 롤백을 분리한다. 신규 additive 컬럼/테이블은 남겨두고 코드만 이전 경로로 돌릴 수 있어야 한다.

## 변경 전 백업

웹사이트 저장소:

- git branch와 status 기록
- 변경 파일 목록 기록
- migration 파일 목록 기록

Collector:

- git repo가 아니므로 파일 백업 필수
- 백업 대상:
  - `IntooniCollector.ps1`
  - `src/*.mjs`
  - `package.json`
  - `.env`는 복사본을 만들되 외부 공유 금지
  - `data/artists.csv`
  - `output/instagram-weekly.xlsx`
  - `output/*.xlsx`

Supabase:

- `categories`
- `artists`
- `artist_stats`
- `artist_contacts`
- `artist_collaborations`
- `artist_b2b_profiles`
- `brand_categories`
- `magazines`
- `magazine_artists`
- `artist_event_logs`
- `sheet_sync_jobs`

가능하면 Supabase dashboard backup 또는 `pg_dump`를 사용한다. 최소한 변경 대상 테이블별 CSV/XLSX export를 남긴다.

Google Sheets:

- `intooni_Database`의 사본 생성
- 탭 구조 변경 전 screenshot 또는 metadata 기록

## Phase별 롤백

### Phase 1: 조사/문서

코드나 DB 변경이 없으므로 롤백은 문서 삭제 또는 갱신으로 충분하다. 단, `docs/`가 이미 untracked였으므로 사용자 파일과 새로 만든 파일을 구분한다.

### Phase 2: Additive migration

문제 발생 시:

- 앱 코드는 기존 컬럼을 계속 사용할 수 있어야 한다.
- 신규 테이블/컬럼은 즉시 drop하지 않는다.
- RLS 강화가 포함되어 public 화면이 깨진 경우, 먼저 코드 public API 경로를 확인하고 필요 시 RLS 변경만 되돌리는 별도 rollback migration을 작성한다.

가능한 rollback SQL:

- 신규 RLS 정책 비활성화/기존 read 정책 임시 복구
- 새 trigger disable
- 새 API가 참조하는 view drop

주의: 새 테이블에 수집된 데이터가 있으면 drop 금지. 사용 중단만 한다.

### Phase 3: Backfill

문제 발생 시:

- backfill 전 row count와 후 row count를 비교한다.
- `artist_stats` backfill이 잘못된 경우 migration 실행 전 백업과 `recorded_date = COALESCE(last_stats_updated_at::date, CURRENT_DATE)` 기준 대조 결과로 정확한 대상 행을 식별한 뒤 별도 rollback SQL을 작성한다.
- `main_category_id` 매핑이 잘못된 경우 기존 `genre` 컬럼을 기준으로 재실행한다.
- `search_tags`가 잘못된 경우 기존 `hidden_tags`가 남아 있으므로 재생성한다.
- `magazine_artists`가 잘못된 경우 기존 `related_artist_ids`가 남아 있으므로 재생성한다.

금지:

- 기존 `genre`, `hidden_tags`, `related_artist_ids` 삭제 전 rollback 자료로 사용하는 것.

### Phase 4: 애플리케이션 전환

문제 발생 시:

- public API 도입 후 장애: 홈/상세를 이전 direct query 코드로 되돌릴 수 있지만 민감정보 위험이 있으므로 운영 공개 전환 전 테스트 환경에서 잡는다.
- Admin Sheets 장애: `GOOGLE_SHEETS_ENABLED=false`로 비활성화하고 Admin 수동 편집 유지.
- Collector Sheets sync 장애: XLSX 저장은 유지하고 Sheets sync만 skip한다.
- Collector Apply 장애: `artist_stats` upsert 이전 상태면 재실행 가능해야 한다. upsert 후 revalidate 실패는 DB 롤백 대상이 아니며 경고만 남긴다.

### Phase 5: 보안 적용

문제 발생 시:

- Admin 로그인 실패: 새 HMAC cookie 검증을 점검하고, `ADMIN_SESSION_SECRET` 미설정이면 명확히 500으로 실패시킨다.
- RLS로 server API 실패: service role client 경로를 확인한다.
- anon 직접 조회 차단으로 public UI가 실패: public UI가 server DTO API를 사용하고 있는지 확인한다.

### Phase 7: Cleanup

cleanup 전 필수 조건:

- `rg`로 legacy 컬럼 참조 0개 확인
- Collector 신규 코드에서 `artists.followers`, `artists.post_count`, `weekly_*`, `stats_period_*` update가 0개인지 확인
- public DTO 테스트 통과
- Admin/Collector/Sheets apply 통합 테스트 통과
- backfill 보고서와 row count 일치

cleanup 후 문제 발생 시:

- cleanup 직전 DB backup과 `private.migration_legacy_backup`의 row count를 모두 확인한다.
- `migration_legacy_backup`의 `source_table`, `source_id`, `row_data` JSON을 사용해 제거된 컬럼/테이블을 별도 rollback migration으로 복원한다.
- 자동 down migration은 제공하지 않는다. FK와 enum을 포함한 목표 스키마를 훼손하지 않도록 복원 SQL을 검토한 뒤 실행한다.

## Feature Flags / Kill Switches

권장 환경변수:

- `GOOGLE_SHEETS_ENABLED=false`: Sheets export/import 비활성화
- `COLLECTOR_GOOGLE_SHEETS_ENABLED=false`: Collector Sheets sync 비활성화
- `COLLECTOR_REVALIDATE_ENABLED=false`: Apply 후 revalidate 호출 비활성화
- `NEXT_PUBLIC_SITE_URL`은 운영 canonical로 사용하지 않도록 refactor 후 제거 또는 제한

## 운영자 수동 조치

Vercel:

- `ADMIN_SESSION_SECRET` 설정
- Google service account env 설정
- `COLLECTOR_REVALIDATE_SECRET` 설정
- build 실패 시 직전 성공 배포로 rollback

Supabase:

- migration 적용 전 backup
- migration 적용 후 row count와 RLS 검증
- 잘못된 migration은 새 rollback migration으로 되돌림

Google Cloud/Sheets:

- service account 권한 제거로 Sheets 연동 즉시 차단 가능
- Spreadsheet 사본을 기준으로 탭/헤더 복구 가능

Collector:

- 백업한 `src/*.mjs`, `IntooniCollector.ps1`, `package.json` 복원
- 기존 `output/instagram-weekly.xlsx`와 `data/artists.csv`로 GUI 사용 가능
- `apply-approved.mjs` 구버전 복원 전에는 운영 DB에 legacy 컬럼을 쓸 수 있음을 명시적으로 확인

## 롤백 완료 확인

- 사이트 홈과 작가 상세가 정상 렌더링됨
- Admin 로그인이 정상 동작함
- Collector summary가 `output/instagram-weekly.xlsx`를 읽음
- Sheets 연동 장애가 사이트/API 장애로 전파되지 않음
- public API에 금지 키가 없음
- DB row count가 rollback 전 기대값과 일치함
