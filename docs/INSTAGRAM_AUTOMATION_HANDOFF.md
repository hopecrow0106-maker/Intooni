# Intooni Instagram Stats Automation Handoff

작성일: 2026-07-11
대상: 다음 작업을 이어받는 ChatGPT 또는 개발자
관련 저장소: `C:\Users\user\Desktop\Instoon`
관련 로컬 수집 프로그램: `C:\Users\user\Desktop\Projects Files\intooni_Collect`

## 1. 한 줄 요약

인투니는 Instagram 공식 API가 아니라, 관리자가 직접 실행하는 별도 Windows 수집 프로그램으로 작가별 팔로워 수와 게시물 수를 수집한다. 수집 결과는 Excel에 기록되고, 관리자가 `Apply Approved`를 누르면 Supabase `artists` 테이블에 팔로워, 게시물, 주간 증가수, 주간 증가율, 집계 기간이 반영된다. 인투니 웹사이트 홈 화면은 그 DB 값을 읽어서 성장 Top 5 그래프를 보여준다.

## 2. 전체 흐름

```text
인투니 관리자 사이트에서 작가 추가/수정
  -> Collector에서 Update New Artists
  -> Supabase artists 목록을 data/artists.csv로 동기화
  -> Collector에서 Collect All
  -> Instagram 프로필을 브라우저로 열고 HTML/meta 기반 수집
  -> output/instagram-weekly.xlsx에 Records, Latest, Failures, Top5 기록
  -> 관리자가 결과 확인
  -> Apply Approved
  -> Supabase artists 테이블 업데이트
  -> 인투니 웹사이트 홈 성장 그래프에 자동 반영
```

중요한 점:

- Excel은 수동 업로드용이 아니라, 기록 확인과 승인 보조용이다.
- 실제 웹사이트 반영은 Collector의 `Apply Approved`가 Supabase에 직접 업데이트하면서 일어난다.
- 자동 스케줄러가 아니다. 관리자가 매주 필요할 때 버튼을 눌러 실행한다.
- Instagram 공식 API가 아니므로 실패 가능성이 있다. 실패해도 전체 작업을 중단하지 않고 실패 목록에 남긴다.

## 3. 본체 웹사이트 변경 사항

### 3.1 DB 컬럼

파일:

- `C:\Users\user\Desktop\Instoon\supabase\weekly_growth_columns.sql`
- `C:\Users\user\Desktop\Instoon\supabase\schema.sql`
- `C:\Users\user\Desktop\Instoon\lib\types.ts`

추가된 `artists` 컬럼:

```sql
weekly_follower_growth integer not null default 0
weekly_post_growth integer not null default 0
weekly_follower_growth_rate numeric not null default 0
weekly_post_growth_rate numeric not null default 0
stats_period_start date
stats_period_end date
```

기존에 사용하던 컬럼 중 Collector가 같이 업데이트하는 주요 필드:

```text
followers
post_count
last_stats_updated_at
```

증가율 저장 규칙:

- DB에는 퍼센트 숫자로 저장한다.
- 예: `145.45%`는 `145.45`로 저장한다.
- Excel 내부에서 `1.4545`처럼 fraction으로 읽히는 경우 `apply-approved.mjs`가 `145.45`로 변환한다.

### 3.2 홈 화면 성장 그래프

파일:

- `C:\Users\user\Desktop\Instoon\app\page.tsx`
- `C:\Users\user\Desktop\Instoon\app\globals.css`

`app/page.tsx`의 주요 구조:

- `GrowthChartSection`
- `getWeeklyGrowthValue`
- `getGrowthPeriodLabel`
- `featuredWeeklyGrowthArtists`

홈 화면에서 보여주는 4가지 필터:

```text
팔로워 증가수
팔로워 증가율
게시물 증가수
게시물 증가율
```

정렬 방식:

- 현재 선택된 metric과 value mode 기준으로 값이 큰 작가 Top 5를 보여준다.
- 값이 0 이하인 작가는 그래프에서 제외된다.
- 증가율이 100%를 넘는 경우도 정상 표시된다. 그래프 스케일은 최대값 기준으로 잡고, 100% 기준선이 필요한 경우 표시한다.

집계 기간 표시:

- `stats_period_start`, `stats_period_end`가 있는 작가를 찾아 기간 라벨을 만든다.
- Collector에서 Apply할 때 모든 업데이트 row에 동일한 기간을 넣는 것이 전제다.

애니메이션:

- `app/globals.css`의 `growth-row`, `growth-bar-fill`, `growth-value-pop` 애니메이션을 사용한다.
- 필터 버튼을 누르면 막대가 순차적으로 채워지는 효과가 있다.

### 3.3 관리자 폼

파일:

- `C:\Users\user\Desktop\Instoon\components\admin\ArtistForm.tsx`

관리자 폼에서도 아래 값을 수동 확인 또는 수정할 수 있게 되어 있다.

```text
weekly_follower_growth
weekly_post_growth
weekly_follower_growth_rate
weekly_post_growth_rate
```

일반적으로는 직접 입력하지 않고 Collector의 `Apply Approved`로 업데이트한다.

## 4. Collector 프로그램 구조

위치:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect
```

주요 파일:

| 파일 | 역할 |
| --- | --- |
| `06_open_program.bat` | 사용자가 실행하는 Windows 프로그램 시작 파일 |
| `IntooniCollector.ps1` | Windows Forms GUI 본체 |
| `src/export-artists.mjs` | Supabase `artists` 목록을 `data/artists.csv`로 내보냄 |
| `src/collect.mjs` | Instagram 프로필을 열고 팔로워/게시물 수집 |
| `src/apply-approved.mjs` | Excel Latest 결과를 Supabase에 반영 |
| `src/retry-failed.mjs` | 실패한 작가만 다시 수집 |
| `src/refresh-failed-handles.mjs` | admin에서 바뀐 Instagram handle을 실패 목록에 다시 반영 |
| `src/remove-failure.mjs` | 실패 목록에서 선택 작가 제거 및 재시도 제외 |
| `src/summary.mjs` | GUI에 표시할 현재 CSV, Excel, Top5, 실패 목록 요약 생성 |
| `data/artists.csv` | 수집 대상 작가 목록 |
| `output/instagram-weekly.xlsx` | 수집 결과 Excel |
| `browser-profile/` | Instagram 로그인 세션이 저장되는 Playwright 브라우저 프로필 |

## 5. Collector 버튼 의미

### Update New Artists

Supabase `artists` 테이블에서 최신 작가 목록을 가져와 `data/artists.csv`를 갱신한다.

사용 상황:

- 인투니 admin에서 신규 작가를 추가한 뒤
- 기존 작가의 Instagram handle을 수정한 뒤
- Collector가 오래된 작가 목록을 쓰고 있을 때

실행 스크립트:

```bash
node src/export-artists.mjs
```

### Collect All

`data/artists.csv`에 있는 모든 작가를 대상으로 Instagram 프로필 수집을 진행한다.

실행 스크립트:

```bash
node src/collect.mjs --source csv
```

수집 결과:

- 성공: `Latest`와 `Records`에 기록
- 실패: `Latest`, `Records`, `Failures`에 실패 상태와 이유 기록
- Top5: 성공 row 기준으로 4개 metric Top 5 생성

### Sync Failed Handles

실패 목록에 남아 있는 작가의 Instagram handle이 admin에서 수정된 경우, Supabase에서 최신 작가 목록을 다시 가져와 Excel 안의 실패 row를 최신 handle과 URL로 갱신한다.

사용 상황:

- 실패 원인이 삭제가 아니라 아이디 변경으로 보일 때
- admin에서 handle을 고친 뒤, 실패 목록도 최신 값으로 맞추고 싶을 때

실행 스크립트:

```bash
node src/refresh-failed-handles.mjs
```

새 작가로 추가되는 것이 아니라, 같은 `artist_id` 기준으로 기존 실패 row의 handle과 URL을 바꾼다.

### Retry Failed

실패한 작가만 다시 수집한다.

입력창:

- 비워두면 현재 `Latest`의 실패 목록을 재시도한다.
- `YYYY-MM-DD`를 입력하면 해당 날짜의 `Records` 실패분을 기준으로 재시도한다.

실행 스크립트:

```bash
node src/retry-failed.mjs
node src/retry-failed.mjs --failed-date 2026-07-05
```

### Remove Selected Failed

GUI 하단 `Failed / Missing Artists`에서 선택한 작가를 실패 목록에서 제거하고, `IgnoredFailures` 시트에 기록한다.

효과:

- `Latest`와 `Failures`에서 해당 실패 row를 제거한다.
- 이후 일반 재시도 대상에서 제외된다.
- Instagram이 삭제됐거나 더 이상 추적하지 않을 작가에게 사용한다.

실행 스크립트:

```bash
node src/remove-failure.mjs --artist-id <artist_id>
```

### Apply Approved

Excel의 `Latest` 승인 결과를 Supabase `artist_stats` 테이블에 반영한다.

동작:

- 기본적으로 `approve_for_update`가 `YES`인 성공 row만 반영한다.
- GUI에서 승인 row가 없으면 적용하지 않고 `approve_for_update` 승인 안내를 표시한다.
- `--all-success`는 `--dry-run`에서만 허용되며 실제 Supabase 쓰기에는 사용할 수 없다.
- 적용 후 `ApplyLog` 시트에 결과를 남긴다.

실행 스크립트:

```bash
node src/apply-approved.mjs --yes
node src/apply-approved.mjs --dry-run --yes --all-success
node src/sync-google-sheets.mjs --dry-run
npm run verify
```

`IgnoredFailures` syncs to Google Sheets `collector_ignored_failures` with `ignored_at`, `artist_id`, `artist_name`, `instagram_url`, `reason`, `run_id`, and `recorded_date`.

업데이트하는 Supabase 필드:

```text
artist_id
recorded_date
followers
post_count
```

## 6. Excel 구조

파일:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\output\instagram-weekly.xlsx
```

시트:

| 시트 | 역할 |
| --- | --- |
| `Records` | 전체 수집 이력 누적 |
| `Latest` | 작가별 최신 상태 |
| `Failures` | 실패 또는 missing 작가 목록 |
| `Top5` | 4개 metric별 Top 5 |
| `ApplyLog` | Supabase 반영 결과 로그 |
| `IgnoredFailures` | 실패 목록에서 제거한 작가 목록 |

`Latest` 주요 컬럼:

```text
collected_at
artist_id
artist_name
instagram_handle
instagram_url
followers
posts
previous_followers
previous_posts
followers_delta
posts_delta
followers_growth_rate
posts_growth_rate
status
message
approve_for_update
```

증가수/증가율 계산:

- 이전 성공 기록이 있으면 그 기록과 비교한다.
- 이전 성공 기록이 없으면 `data/artists.csv`에 들어 있는 DB 기준값, 즉 기존 `followers`, `post_count`를 baseline으로 사용한다.
- 그래서 첫 주에도 현재 DB 값 대비 증가량을 계산할 수 있다.

## 7. 주차와 기간 계산

파일:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\src\apply-approved.mjs
```

기본 규칙:

- 최초 도입 기간은 `2026-04-01 ~ 2026-07-06`으로 처리한다.
- 그 다음부터는 월요일 기준 주차로 간다.
- `apply-approved.mjs`는 서울 날짜 기준으로 “오늘 또는 이후의 다음 월요일”을 `stats_period_end`로 잡고, 그 7일 전을 `stats_period_start`로 잡는다.

환경 변수로 조정 가능:

```env
INITIAL_STATS_PERIOD_START=2026-04-01
INITIAL_STATS_PERIOD_END=2026-07-06
STATS_PERIOD_DATE=2026-07-13
```

일반 사용자는 Supabase SQL Editor에서 매주 기간을 따로 적을 필요가 없다. Collector가 Apply할 때 기간을 같이 넣는다.

## 8. Instagram 수집 방식

파일:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\src\collect.mjs
```

방식:

- Playwright로 실제 브라우저 프로필을 연다.
- `browser-profile/`에 로그인 세션을 유지한다.
- 작가별 Instagram 프로필 URL을 열고 페이지의 meta 정보를 읽는다.
- HTML/meta에서 팔로워와 게시물 수를 파싱한다.

파싱 관련 함수:

```text
normalizeCount
parseProfileMeta
classifyInstagramFailure
collectOne
```

주의:

- Instagram 공식 API가 아니다.
- HTML 구조나 로그인 상태, 차단, rate limit에 따라 실패할 수 있다.
- 실패해도 전체 수집을 중단하지 않고 실패 row로 남긴다.
- 삭제된 계정, 아이디 변경, 비공개/접근 불가 상태는 실패 목록에서 확인해야 한다.

현재 속도 설정 기본값:

```env
DELAY_MIN_MS=5000
DELAY_MAX_MS=5000
PAGE_DWELL_MIN_MS=800
PAGE_DWELL_MAX_MS=1200
BREAK_EVERY=15
BREAK_MIN_MS=120000
BREAK_MAX_MS=120000
STOP_AFTER_FAILURES=0
```

의미:

- 작가 1명 처리 후 다음 작가까지 약 5초 대기
- 페이지 안에서는 0.8초에서 1.2초 정도 머무름
- 15명마다 2분 휴식
- 실패가 있어도 중단하지 않음

## 9. 환경 변수

Collector의 `.env`에 필요한 값이다. 문서나 Git에는 실제 값을 적지 않는다.

```env
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_UPDATE_KEY=
SUPABASE_ARTISTS_TABLE=artists
SUPABASE_SELECT_COLUMNS=id,name,instagram_handle,followers,post_count
OUTPUT_XLSX=output/instagram-weekly.xlsx

DELAY_MIN_MS=5000
DELAY_MAX_MS=5000
PAGE_DWELL_MIN_MS=800
PAGE_DWELL_MAX_MS=1200
BREAK_EVERY=15
BREAK_MIN_MS=120000
BREAK_MAX_MS=120000
STOP_AFTER_FAILURES=0
```

키 구분:

- `SUPABASE_KEY`: 읽기용. `export-artists.mjs`, `collect.mjs`가 사용한다.
- `SUPABASE_UPDATE_KEY`: 업데이트용. `apply-approved.mjs`가 사용한다.
- 업데이트 키는 가능하면 service role 계열을 사용한다. 절대 클라이언트 코드나 공개 문서에 넣지 않는다.

## 10. 일반 운영 시나리오

### 신규 작가를 admin에서 추가한 경우

1. 인투니 admin에서 작가를 추가한다.
2. Collector를 연다.
3. `Update New Artists`를 누른다.
4. `data/artists.csv`가 최신 Supabase 목록으로 갱신된다.
5. 다음 `Collect All`부터 자동으로 수집 대상에 포함된다.

### 매주 전체 업데이트

1. `Update New Artists`
2. `Collect All`
3. 실패 목록 확인
4. 아이디가 바뀐 작가는 admin에서 handle 수정
5. `Sync Failed Handles`
6. `Retry Failed`
7. 그래도 삭제 또는 접근 불가면 `Remove Selected Failed`
8. 결과 확인 후 `Apply Approved`
9. 인투니 웹사이트 홈의 성장 그래프 확인

### Instagram ID가 바뀐 작가

1. 인투니 admin에서 해당 작가의 `instagram_handle`을 수정한다.
2. Collector에서 `Sync Failed Handles`를 누른다.
3. 실패 목록의 URL이 새 handle로 갱신된다.
4. `Retry Failed`를 누른다.

이때 새 작가로 들어가지 않는다. 같은 `artist_id` 기준으로 갱신된다.

### Instagram이 내려간 작가

1. 실패 목록에서 계속 missing 또는 inaccessible로 남는다.
2. 인투니 admin에서 작가 노출을 내릴지 결정한다.
3. Collector에서는 `Remove Selected Failed`로 실패 목록에서 제거할 수 있다.
4. 제거하면 `IgnoredFailures`에 남고 일반 retry에서 제외된다.

## 11. 개발자가 확인해야 할 명령

인투니 본체:

```bash
cd "C:\Users\user\Desktop\Instoon"
npm run lint -- --no-cache
npx tsc --noEmit
npm run build
```

Collector:

```bash
cd "C:\Users\user\Desktop\Projects Files\intooni_Collect"
npm install
node src/summary.mjs
node src/export-artists.mjs
node src/collect.mjs --source csv --limit 5
node src/apply-approved.mjs --dry-run --yes --all-success
```

Windows GUI 실행:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\06_open_program.bat
```

Instagram 로그인 세션 갱신:

```text
C:\Users\user\Desktop\Projects Files\intooni_Collect\02_login_instagram.bat
```

## 12. 배포 흐름

현재 사용자는 “Codex에서 수정 후 GitHub에 올리면 Vercel이 자동 배포되는” 흐름을 기대한다.

일반 절차:

```bash
cd "C:\Users\user\Desktop\Instoon"
git status
npm run lint -- --no-cache
npx tsc --noEmit
npm run build
git add <changed files>
git commit -m "<message>"
git push origin main
```

Vercel 직접 배포도 가능하지만, 사용자가 선호하는 방식은 GitHub `main` push 후 자동 배포다.

## 13. 주의할 점

- Instagram 수집은 공식 API가 아니므로 “항상 성공”을 전제로 만들면 안 된다.
- 실패한 작가는 반드시 UI에서 확인 가능해야 한다.
- 수집 중 일부 작가가 실패해도 전체 수집은 계속 진행해야 한다.
- Excel은 UTF-8/한글 표시가 깨질 수 있으므로 GUI 문구는 가능한 영어로 유지했다.
- Supabase 업데이트는 `Apply Approved` 전에는 일어나지 않는다.
- `Apply Approved --all-success`는 dry-run 검사 전용이며 실제 적용은 승인된 행만 가능하다.
- `weekly_*_growth_rate`는 fraction이 아니라 percent 숫자다.
- 루트의 `.env` 또는 Collector `.env` 값은 문서화하거나 커밋하지 않는다.
- `browser-profile/`, `node_modules/`, Excel output은 일반적으로 Git 관리 대상이 아니다.

## 14. 다음 ChatGPT에게 전달할 짧은 프롬프트

아래 내용을 그대로 붙여넣으면 된다.

```text
인투니 프로젝트에는 별도 Windows Instagram Collector가 있습니다.

본체 Next.js 앱은 C:\Users\user\Desktop\Instoon 이고, Collector는 C:\Users\user\Desktop\Projects Files\intooni_Collect 입니다.

Collector는 Admin의 active/hidden 작가와 최신 공식 `artist_stats` baseline을 data/artists.csv로 가져오고, Playwright 브라우저 프로필로 Instagram 프로필을 열어 팔로워 수와 게시물 수를 수집합니다. 결과는 output/instagram-weekly.xlsx에 Records, Latest, Failures, Top5, ApplyLog로 기록됩니다. 사용자가 행별 승인 후 Apply Approved를 누르면 Supabase `artist_stats`에 `artist_id`, 원래 `recorded_date`, `followers`, `post_count`만 upsert합니다. Excel은 원본 기록, 승인, 감사, 실패 복구 수단입니다.

인투니 홈 app/page.tsx는 artists의 weekly_* 컬럼을 읽어서 팔로워 증가수, 팔로워 증가율, 게시물 증가수, 게시물 증가율 Top 5 그래프를 보여줍니다. 애니메이션은 app/globals.css의 growth-* 클래스를 사용합니다.

신규 작가가 admin에서 추가되면 Collector에서 Update New Artists를 눌러 CSV를 갱신해야 다음 수집에 포함됩니다. 실패한 작가는 Failed / Missing Artists에 표시되고, 아이디가 바뀐 경우 admin에서 handle을 수정한 뒤 Sync Failed Handles와 Retry Failed를 사용합니다. 삭제된 계정은 Remove Selected Failed로 실패 목록에서 제외할 수 있습니다.

주요 파일:
- Instoon: app/page.tsx, app/globals.css, lib/types.ts, components/admin/ArtistForm.tsx, supabase/weekly_growth_columns.sql
- Collector: IntooniCollector.ps1, src/export-artists.mjs, src/collect.mjs, src/apply-approved.mjs, src/retry-failed.mjs, src/refresh-failed-handles.mjs, src/remove-failure.mjs, src/summary.mjs

주의: Instagram 공식 API가 아니므로 실패 가능성이 있고, 자동 스케줄러가 아니라 관리자가 수동 실행하는 구조입니다. Supabase 키나 .env 값은 노출하지 마세요.
```
