# INTOONI Google Sheets Sync

작성일: 2026-07-11

## 원칙

Google Sheets는 bulk admin 도구다. Supabase를 자동으로 덮어쓰는 실시간 DB가 아니다.

흐름:

```text
Google Sheets
  -> Admin import preview
  -> validation
  -> admin approval
  -> Supabase apply
```

## 환경변수

서버 전용:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=1tFaqt6mlU7bht6qTR5Z_MKbcoKN-Z86LuHrrNCoaTg8
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

금지:

- `NEXT_PUBLIC_` prefix 사용
- 브라우저에 Google credential 전달
- Codex Google Drive/Sheets connector 인증을 웹사이트 런타임 인증으로 간주

## Admin API

모든 endpoint는 Admin signed session이 필요하다.

### Export

```text
POST /api/admin/sheets/export
```

현재 export 대상:

- `categories`
- `brand_categories`
- `artists`
- `artist_stats`
- `artist_contacts`
- `artist_collaborations`
- `artist_b2b_profiles`

동작:

- Google Sheets 해당 탭 범위를 clear
- 1행 헤더와 현재 DB 값을 write
- `sheet_sync_jobs`가 있으면 job log 기록
- additive migration 전 DB에서 내부 보조 테이블이 없으면 해당 탭은 헤더만 export

### Import Preview

```text
POST /api/admin/sheets/import/preview
```

현재 preview/apply 대상:

- `categories`
- `brand_categories`
- `artists`
- `artist_contacts`
- `artist_collaborations`
- `artist_b2b_profiles`
- `artist_stats`

검증:

- 필수 헤더 존재
- 탭별 필수 ID·이름·날짜·숫자·URL·enum 검증
- UUID 및 작가/카테고리 FK 존재 확인
- 중복 handle, 카테고리명, 통계 날짜, 협업 URL, 작가별 단일 contact/B2B 행 검증
- `source_updated_at`과 DB `updated_at` 비교
- `|` 구분 태그/추천 브랜드 파싱 및 NFC/trim 정규화
- 각 행을 `CREATE`, `UPDATE`, `NO_CHANGE`, `CONFLICT`, `ERROR`로 분류

Preview는 원본 관리 데이터를 변경하지 않으며 Admin에서 행별 오류와 before/after 값을 표시한다. Preview job audit log만 `sheet_sync_jobs`에 기록될 수 있다.

### Import Apply

```text
POST /api/admin/sheets/import/apply
```

동작:

- 먼저 preview를 실행
- validation error 또는 stale conflict가 있으면 400으로 실패하고 대상 원본 테이블 변경 없음
- `CREATE`와 `UPDATE` 행만 해당 Supabase 테이블에 insert/update/upsert
- `NO_CHANGE` 행은 쓰지 않음
- `sheet_sync_jobs`가 있으면 job log 기록

주의:

- 시트 행 삭제는 DB 삭제가 아니다.
- `artist_stats`는 자동 동기화 대상이 아니며, 요청 본문에 `{"sheet":"artist_stats"}`를 보낸 명시적인 Admin apply에서만 `artist_stats`에 upsert된다.
- 일반 apply는 additive migration 이후의 새 테이블/컬럼을 대상으로 한다. migration 전 운영 DB에서는 preview/export 위주로 사용한다.

### Jobs

```text
GET /api/admin/sheets/jobs
```

최근 `sheet_sync_jobs` 50개를 반환한다. 테이블이 아직 없으면 빈 배열을 반환한다.

## 구현 파일

- `lib/server/google-sheets.ts`
- `lib/server/admin-sheets.ts`
- `lib/sheets/artist-sheet.ts`
- `lib/sheets/admin-data-sheets.ts`
- `app/api/admin/sheets/export/route.ts`
- `app/api/admin/sheets/import/preview/route.ts`
- `app/api/admin/sheets/import/apply/route.ts`
- `app/api/admin/sheets/jobs/route.ts`
- `tests/artist-sheet.test.ts`
- `tests/admin-sheets-export.test.ts`
- `tests/admin-sheets-import.test.ts`
- `tests/admin-data-sheets.test.ts`
- `tests/admin-general-sheets-import.test.ts`
- `tests/admin-sheets-routes.test.ts`

## Collector sync

Collector sync is separate from Admin import/export.

```text
Collector XLSX
  -> src/sync-google-sheets.mjs
  -> collector_* review tabs
```

Current Collector sync targets:

- `collector_records`
- `collector_latest`
- `collector_failures`
- `collector_top5`
- `collector_apply_log`
- `collector_ignored_failures`

`collector_ignored_failures` receives local `IgnoredFailures` rows with:

```text
ignored_at
artist_id
artist_name
instagram_url
reason
run_id
recorded_date
```

Collector `npm run verify` checks local workbook header constants against the Google Sheets target header order.

## 검증

로컬 자동 테스트:

```bash
npm run test
npm run typecheck
npm run build
```

추가 확인:

- `tests/admin-sheets-routes.test.ts` confirms every Admin Sheets route returns 401 without a signed Admin session and does not call the Sheets/Supabase service layer.
- `tests/admin-sheets-export.test.ts` confirms Admin export selects additive `updated_at` fields, resolves FK category names for artist rows, and records the configured spreadsheet id in `sheet_sync_jobs`.
- `tests/admin-sheets-import.test.ts` confirms preview parses rows without mutating artist source data, apply stops before artist writes when validation errors exist, and apply writes only validated artist rows after category lookup.
- `tests/admin-sheets-import.test.ts` also confirms `artist_stats` preview does not mutate official stats, invalid rows stop before lookup/upsert, and valid rows upsert by `(artist_id, recorded_date)` only after validation passes.
- `tests/admin-data-sheets.test.ts` validates category, contact, collaboration, and B2B row parsing.
- `tests/admin-general-sheets-import.test.ts` verifies stale category conflicts and approved category/contact/collaboration/B2B writes.
- `tests/admin-sheets-ui-source.test.ts` confirms the Admin page exposes the general target selector, row-level preview table, and separate explicit `artist_stats` operation wiring.
- Connected Google Sheet metadata/header readback on 2026-07-11 confirmed the target spreadsheet title, all expected tabs, frozen header rows, and the expected header order for Admin and Collector tabs.
- The seven management tabs were rewritten to the exact final ranges `A:D`, `A:D`, `A:V`, `A:D`, `A:D`, `A:M`, and `A:F`, then read back with the expected headers and consistent header formatting.

Admin/Collector write calls to the live Google Sheets API still require service account env and sheet sharing confirmation before execution.
