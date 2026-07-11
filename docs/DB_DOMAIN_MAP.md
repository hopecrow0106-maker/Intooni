# 인투니 DB 권장 분류 지도

인투니 운영 DB의 테이블은 물리적으로 `public` 스키마에 유지하되, 업무 책임에 따라 여섯 영역으로 분류한다. 테이블 이동이나 이름 변경 없이 PostgreSQL 테이블 설명에 영역 접두어를 저장한다.

| 접두어 | 영역 | 테이블 수 | 책임 |
|---|---|---:|---|
| `CORE` | 작가 핵심 | 3 | 작가, 카테고리, 날짜별 통계 |
| `BUSINESS` | 내부 운영·협업 | 5 | 연락처, 브랜드, 협업, B2B 분석 |
| `EDITORIAL` | 매거진 | 2 | 글과 관련 작가 연결 |
| `TOONBTI` | 테스트 | 4 | 테스트, 노드, 경로, 추천 작가 |
| `ANALYTICS` | 행동 분석 | 2 | 클릭과 검색 로그 |
| `OPS` | 운영·복구 | 2 | Sheets 작업 감사와 이전 구조 백업 |

## 전체 지도

```mermaid
flowchart LR
  subgraph CORE["CORE · 작가 핵심"]
    categories --> artists --> artist_stats
  end

  subgraph BUSINESS["BUSINESS · 내부 운영과 협업"]
    artist_contacts
    brand_categories
    artist_recommended_brand_categories
    artist_b2b_profiles
    artist_collaborations
  end

  subgraph EDITORIAL["EDITORIAL · 매거진"]
    magazines --> magazine_artists
  end

  subgraph TOONBTI["TOONBTI · 테스트"]
    toon_tests --> toon_nodes
    toon_tests --> toon_edges
    toon_nodes --> toon_result_artists
  end

  subgraph ANALYTICS["ANALYTICS · 행동 분석"]
    artist_event_logs
    search_query_logs
  end

  subgraph OPS["OPS · 운영과 복구"]
    sheet_sync_jobs
    migration_legacy_backup
  end

  artists --> BUSINESS
  artists --> magazine_artists
  artists --> toon_result_artists
  artists --> artist_event_logs
```

## CORE

```mermaid
erDiagram
  categories ||--o{ artists : "main_category_id"
  artists ||--o{ artist_stats : "artist_id"
```

- `categories`: 공개 작가 카테고리
- `artists`: 작가 프로필과 노출 설정의 공식 원본
- `artist_stats`: 작가별 날짜 통계 스냅샷

## BUSINESS

```mermaid
erDiagram
  artists ||--o| artist_contacts : "artist_id"
  artists ||--o| artist_b2b_profiles : "artist_id"
  artists ||--o{ artist_collaborations : "artist_id"
  artists ||--o{ artist_recommended_brand_categories : "artist_id"
  brand_categories ||--o{ artist_recommended_brand_categories : "brand_category_id"
  brand_categories ||--o{ artist_collaborations : "brand_category_id"
```

- 공개 웹사이트와 분리해야 하는 내부 데이터다.
- 작가 삭제보다 `artists.status='archived'`를 우선한다.
- 연락처와 B2B 프로필은 작가당 최대 한 행이고, 협업은 여러 행이다.

## EDITORIAL

```mermaid
erDiagram
  magazines ||--o{ magazine_artists : "magazine_id"
  artists ||--o{ magazine_artists : "artist_id"
```

- `magazines`: 매거진 글 자체
- `magazine_artists`: 글 안에서 임베드할 작가와 표시 순서

## TOONBTI

```mermaid
erDiagram
  toon_tests ||--o{ toon_nodes : "test_id"
  toon_tests ||--o{ toon_edges : "test_id"
  toon_nodes ||--o{ toon_result_artists : "result_node_key"
  artists ||--o{ toon_result_artists : "artist_id"
```

질문지 편집 도메인이다. 작가 관리와 별도 기능으로 이해한다.

## ANALYTICS

```mermaid
erDiagram
  artists ||--o{ artist_event_logs : "artist_id"
```

- `artist_event_logs`: 작가·Instagram 이동 이벤트
- `search_query_logs`: 검색어 이벤트

원시 로그가 매우 커진 뒤에만 집계 테이블, 보관 정책, 날짜 파티셔닝을 검토한다.

## OPS

- `sheet_sync_jobs`: Sheets Export/Preview/Apply 감사 로그
- `migration_legacy_backup`: 이전 DB 구조의 복구 증거

두 테이블은 업무 데이터가 아니므로 일반 작가 기능에서 읽지 않는다.

## 왜 테이블을 실제로 다른 스키마로 옮기지 않는가

`public.artists`를 `core.artists`처럼 물리적으로 이동하면 Supabase PostgREST 설정, 모든 `.from()` 호출, RLS, 함수, Collector를 함께 변경해야 한다. 분류 목적에 비해 장애 위험이 크다.

현재 단계의 정돈 원칙:

1. 실제 테이블과 관계는 유지한다.
2. 테이블 설명에 영역 접두어를 기록한다.
3. 문서에서는 영역별 ERD를 사용한다.
4. 기능이 커져 독립 배포가 필요해질 때만 PostgreSQL 스키마 분리를 검토한다.
