# INTOONI Sheets Column Reference

작성일: 2026-07-11

대상 Google Sheet: [intooni_Database](https://docs.google.com/spreadsheets/d/1tFaqt6mlU7bht6qTR5Z_MKbcoKN-Z86LuHrrNCoaTg8/edit)

## 초기화 결과

2026-07-11에 Google Drive/Sheets connector로 기존 기본 탭 `시트1`을 `categories`로 변경하고, 아래 13개 탭의 1행 헤더를 생성했다. 같은 날 관리용 7개 탭을 이 문서의 최종 계약으로 다시 맞췄다. 각 탭은 1행 freeze와 기본 filter를 적용했다.

생성된 탭:

- `categories`
- `brand_categories`
- `artists`
- `artist_stats`
- `artist_contacts`
- `artist_collaborations`
- `artist_b2b_profiles`
- `collector_latest`
- `collector_records`
- `collector_failures`
- `collector_top5`
- `collector_apply_log`
- `collector_ignored_failures`

## 공통 규칙

- 다중 태그는 `|`로 구분한다.
- 빈 문자열은 import layer에서 nullable 필드의 `null` 또는 빈 배열로 정규화한다.
- 모든 한글 텍스트는 NFC로 정규화한다.
- Sheets 행 삭제는 DB 삭제가 아니다.
- `artist_stats`는 일반 export/view 탭이며 공식 통계 원본은 Supabase `artist_stats`다.
- `collector_*` 탭은 Collector 검토와 운영 보조용이며, 편집만으로 DB에 자동 반영되지 않는다.
- Admin의 일반 preview/apply 대상은 `categories`, `brand_categories`, `artists`, `artist_contacts`, `artist_collaborations`, `artist_b2b_profiles`다.
- `artist_stats`는 일반 흐름과 분리된 명시적 과거 통계 백필 모드에서만 preview/apply한다.
- 현재 Admin export 대상은 `categories`, `brand_categories`, `artists`, `artist_stats`, `artist_contacts`, `artist_collaborations`, `artist_b2b_profiles`다.
- 라이브 readback에서 위 7개 관리 탭은 데이터 행 없이 헤더 행만 존재했으므로 기존 행 재배치 없이 안전하게 헤더를 갱신했다.
- 최종 readback에서 7개 헤더, 회색 굵은 헤더 서식, frozen row 1을 확인했다.

## `categories`

```text
category_id
name
sort_order
updated_at
```

## `brand_categories`

```text
brand_category_id
name
sort_order
updated_at
```

## `artists`

```text
artist_id
name
instagram_handle
main_category_id
main_category_name
bio
hashtags
search_tags
mood_tags
style_tags
topic_tags
thumbnail_url
character_url
gallery_post_urls
show_on_site
show_growth_on_site
is_trending
hide_from_new
status
sort_order
internal_memo
source_updated_at
```

Import 주의:

- `instagram_handle`은 `@` 제거, trim, lower-case로 정규화한다.
- `status` 허용값은 `active`, `hidden`, `archived`다.
- `show_on_site`, `show_growth_on_site`, `is_trending`, `hide_from_new`는 boolean으로 검증한다.
- `internal_memo`는 public DTO에 포함하면 안 된다.

## `artist_stats`

```text
artist_id
recorded_date
followers
post_count
```

Import 주의:

- 일반 import에서는 읽기 전용/export view로 취급한다.
- 예외적인 backfill 모드에서만 제한적으로 import한다.
- `(artist_id, recorded_date)` 중복은 오류 또는 upsert preview로 명시한다.
- `followers`, `post_count`는 0 이상 정수다.

## `artist_contacts`

```text
artist_id
email
dm_available
source_updated_at
```

이 탭의 값은 public page/API/metadata/sitemap에 노출하지 않는다.

## `artist_collaborations`

```text
collaboration_id
artist_id
brand_name
brand_category_id
brand_category_name
collaboration_year
collaboration_month
post_url
content_summary
ad_disclosure_status
likes
comments
views
source_updated_at
```

`content_summary`는 협업 게시물의 내용이나 캠페인 메모를 기록하는 내부 전용 열이다.
이 탭의 값은 public page/API/metadata/sitemap에 노출하지 않는다.

## `artist_b2b_profiles`

```text
artist_id
recommended_brand_categories
strengths
cautions
brand_safety_grade
source_updated_at
```

이 탭의 값은 public page/API/metadata/sitemap에 노출하지 않는다.

## `collector_latest`

```text
approve_for_update
run_id
recorded_date
collected_at
artist_id
artist_name
instagram_handle
instagram_url
followers
posts
previous_recorded_date
previous_followers
previous_posts
followers_delta
followers_growth_rate
posts_delta
posts_growth_rate
status
error_message
debug
applied_at
apply_status
```

## `collector_records`

```text
run_id
recorded_date
collected_at
artist_id
artist_name
instagram_handle
instagram_url
followers
posts
previous_recorded_date
previous_followers
previous_posts
followers_delta
followers_growth_rate
posts_delta
posts_growth_rate
status
error_message
debug
```

## `collector_failures`

```text
run_id
recorded_date
collected_at
artist_id
artist_name
instagram_handle
instagram_url
status
error_message
debug
resolved
ignored_reason
```

## `collector_top5`

```text
run_id
recorded_date
metric
rank
artist_id
artist_name
instagram_handle
value
followers
posts
previous_followers
previous_posts
collected_at
```

Top5는 표시 보조 데이터다. 공식 성장값은 `artist_stats` snapshots에서 계산한다.

## `collector_apply_log`

```text
applied_at
run_id
recorded_date
artist_id
artist_name
instagram_handle
followers
posts
followers_delta
followers_growth_rate
posts_delta
posts_growth_rate
status
message
revalidate_status
```

증감값은 감사·검토용 로그이며 Supabase `artist_stats`에는 저장하지 않는다. 2026-07-11 live readback에서 이 15컬럼 순서, 회색 굵은 헤더, frozen row 1, A:O 필터 범위를 확인했다.

## `collector_ignored_failures`

```text
ignored_at
artist_id
artist_name
instagram_url
reason
run_id
recorded_date
```
