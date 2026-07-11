from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "intooni_database_learning_guide.pdf"

FONT_REGULAR = "C:/Windows/Fonts/malgun.ttf"
FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"

INK = colors.HexColor("#17202A")
MUTED = colors.HexColor("#5D6873")
LINE = colors.HexColor("#D8DEE5")
PAPER = colors.HexColor("#F5F7F9")
WHITE = colors.white
CORE = colors.HexColor("#2563EB")
BUSINESS = colors.HexColor("#0F8A70")
EDITORIAL = colors.HexColor("#D55343")
TOONBTI = colors.HexColor("#7357C9")
ANALYTICS = colors.HexColor("#C47A16")
OPS = colors.HexColor("#52616B")


pdfmetrics.registerFont(TTFont("Malgun", FONT_REGULAR))
pdfmetrics.registerFont(TTFont("Malgun-Bold", FONT_BOLD))


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="KoBody",
        fontName="Malgun",
        fontSize=9.2,
        leading=14.5,
        textColor=INK,
        wordWrap="CJK",
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="KoSmall",
        parent=styles["KoBody"],
        fontSize=7.6,
        leading=11.2,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="KoH1",
        fontName="Malgun-Bold",
        fontSize=23,
        leading=30,
        textColor=INK,
        wordWrap="CJK",
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="KoH2",
        fontName="Malgun-Bold",
        fontSize=15,
        leading=21,
        textColor=INK,
        wordWrap="CJK",
        spaceBefore=4,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="KoH3",
        fontName="Malgun-Bold",
        fontSize=11.2,
        leading=16,
        textColor=INK,
        wordWrap="CJK",
        spaceBefore=5,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="KoTitle",
        fontName="Malgun-Bold",
        fontSize=29,
        leading=39,
        textColor=WHITE,
        alignment=TA_LEFT,
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="KoCoverSub",
        fontName="Malgun",
        fontSize=12,
        leading=19,
        textColor=colors.HexColor("#DDE7F0"),
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="KoTableHeader",
        fontName="Malgun-Bold",
        fontSize=7.6,
        leading=10,
        textColor=WHITE,
        alignment=TA_LEFT,
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="KoTableCell",
        fontName="Malgun",
        fontSize=7.3,
        leading=10.5,
        textColor=INK,
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="KoCode",
        fontName="Malgun",
        fontSize=7.4,
        leading=11,
        textColor=colors.HexColor("#E8EDF2"),
        backColor=INK,
        borderPadding=8,
        leftIndent=0,
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="KoCallout",
        parent=styles["KoBody"],
        fontSize=8.8,
        leading=14,
        borderColor=colors.HexColor("#A8C7FA"),
        borderWidth=0.7,
        borderPadding=9,
        backColor=colors.HexColor("#EDF4FF"),
        spaceBefore=5,
        spaceAfter=8,
    )
)


def P(text, style="KoBody"):
    return Paragraph(text, styles[style])


def bullet(text):
    return P(f"• {text}", "KoBody")


def section(title, kicker=None):
    parts = [Spacer(1, 3 * mm)]
    if kicker:
        parts.append(P(kicker.upper(), "KoSmall"))
    parts.append(P(title, "KoH1"))
    parts.append(Spacer(1, 2 * mm))
    return parts


def info_table(headers, rows, widths=None, header_color=INK, repeat_rows=1):
    data = [[P(str(h), "KoTableHeader") for h in headers]]
    for row in rows:
        data.append([P(str(cell), "KoTableCell") for cell in row])
    table = Table(data, colWidths=widths, repeatRows=repeat_rows, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


class ArchitectureDiagram(Flowable):
    def __init__(self, width=170 * mm, height=62 * mm):
        super().__init__()
        self.width = width
        self.height = height

    def draw_box(self, canvas, x, y, w, h, title, subtitle, fill):
        canvas.setFillColor(fill)
        canvas.roundRect(x, y, w, h, 5, stroke=0, fill=1)
        canvas.setFillColor(WHITE)
        canvas.setFont("Malgun-Bold", 9)
        canvas.drawString(x + 7, y + h - 14, title)
        canvas.setFont("Malgun", 6.8)
        canvas.drawString(x + 7, y + 7, subtitle)

    def arrow(self, canvas, x1, y1, x2, y2, label=""):
        canvas.setStrokeColor(colors.HexColor("#82909C"))
        canvas.setLineWidth(0.8)
        canvas.line(x1, y1, x2, y2)
        angle = 4
        canvas.line(x2, y2, x2 - angle, y2 + angle / 2)
        canvas.line(x2, y2, x2 - angle, y2 - angle / 2)
        if label:
            canvas.setFillColor(MUTED)
            canvas.setFont("Malgun", 6.2)
            canvas.drawCentredString((x1 + x2) / 2, y1 + 4, label)

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        self.draw_box(c, 0, h - 52, 90, 40, "Admin", "운영자 편집 UI", CORE)
        self.draw_box(c, 0, 10, 90, 40, "Collector", "Instagram 수집·승인", ANALYTICS)
        self.draw_box(c, 143, h / 2 - 20, 110, 44, "Supabase", "공식 원본 DB", INK)
        self.draw_box(c, 310, h - 52, 95, 40, "웹사이트", "공개 DTO 조회", EDITORIAL)
        self.draw_box(c, 310, 10, 95, 40, "Google Sheets", "검수·조회 화면", BUSINESS)
        self.arrow(c, 90, h - 32, 143, h / 2 + 5, "저장")
        self.arrow(c, 90, 30, 143, h / 2 - 5, "승인 반영")
        self.arrow(c, 253, h / 2 + 5, 310, h - 32, "공개")
        self.arrow(c, 253, h / 2 - 5, 310, 30, "Export")


class DomainMap(Flowable):
    def __init__(self, width=170 * mm, height=85 * mm):
        super().__init__()
        self.width = width
        self.height = height

    def domain(self, c, x, y, w, h, label, tables, fill):
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, 5, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Malgun-Bold", 8.3)
        c.drawString(x + 7, y + h - 14, label)
        c.setFont("Malgun", 5.8)
        line_y = y + h - 27
        for name in tables:
            c.drawString(x + 7, line_y, name)
            line_y -= 9

    def draw(self):
        c = self.canv
        self.domain(c, 0, 145, 120, 78, "CORE · 작가 핵심", ["categories", "artists", "artist_stats"], CORE)
        self.domain(c, 135, 112, 145, 111, "BUSINESS · 내부 운영", ["artist_contacts", "brand_categories", "recommended_brand_categories", "artist_b2b_profiles", "artist_collaborations"], BUSINESS)
        self.domain(c, 295, 145, 110, 78, "EDITORIAL · 매거진", ["magazines", "magazine_artists"], EDITORIAL)
        self.domain(c, 0, 10, 135, 110, "TOONBTI · 테스트", ["toon_tests", "toon_nodes", "toon_edges", "toon_result_artists"], TOONBTI)
        self.domain(c, 150, 42, 120, 78, "ANALYTICS · 행동", ["artist_event_logs", "search_query_logs"], ANALYTICS)
        self.domain(c, 285, 42, 120, 78, "OPS · 운영·복구", ["sheet_sync_jobs", "migration_legacy_backup"], OPS)


def header_footer(canvas, doc):
    canvas.saveState()
    page = canvas.getPageNumber()
    if page > 1:
        canvas.setStrokeColor(LINE)
        canvas.line(20 * mm, 282 * mm, 190 * mm, 282 * mm)
        canvas.setFont("Malgun", 7.2)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 286 * mm, "INTOONI DATABASE LEARNING GUIDE")
        canvas.drawRightString(190 * mm, 12 * mm, f"{page}")
        canvas.drawString(20 * mm, 12 * mm, "운영 기준일 2026-07-11")
    canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFillColor(CORE)
    canvas.rect(0, 0, 18 * mm, A4[1], stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#283847"))
    canvas.roundRect(28 * mm, 72 * mm, 155 * mm, 145 * mm, 6, stroke=0, fill=1)
    p = P("인투니 데이터베이스<br/>학습 및 운영 가이드", "KoTitle")
    p.wrapOn(canvas, 135 * mm, 70 * mm)
    p.drawOn(canvas, 38 * mm, 157 * mm)
    sub = P("Supabase 구조 · Google Sheets · Collector · 통계 설계", "KoCoverSub")
    sub.wrapOn(canvas, 135 * mm, 30 * mm)
    sub.drawOn(canvas, 38 * mm, 128 * mm)
    canvas.setFillColor(colors.HexColor("#93A7B8"))
    canvas.setFont("Malgun", 9)
    canvas.drawString(38 * mm, 91 * mm, "프로젝트: INTOONI")
    canvas.drawString(38 * mm, 82 * mm, "운영 DB: Supabase npnqyofsspdzndauzmmj")
    canvas.drawString(38 * mm, 73 * mm, "작성 기준: 2026-07-11")
    canvas.setFillColor(colors.HexColor("#DDE7F0"))
    canvas.setFont("Malgun-Bold", 8.5)
    canvas.drawString(28 * mm, 28 * mm, "공식 원본은 Supabase, Sheets는 검수·조회, Collector는 통계 수집 도구")
    canvas.restoreState()


def build_story():
    story = [Spacer(1, 250 * mm), PageBreak()]

    story += section("이 문서를 읽는 방법", "00 · Orientation")
    story.append(P("이 문서는 DB를 처음 공부하는 운영자가 실제 인투니 구조를 따라가며 관계형 데이터베이스를 이해할 수 있도록 구성했다."))
    story.append(P("<b>권장 순서:</b> 전체 흐름 → 도메인 분류 → 핵심 테이블 → 통계 → 내부 운영 → Sheets·Collector → SQL 실습"))
    story.append(Spacer(1, 4 * mm))
    story.append(
        info_table(
            ["기호", "뜻", "인투니 예시"],
            [
                ["PK", "Primary Key. 한 행을 고유하게 식별", "artists.id"],
                ["FK", "Foreign Key. 다른 테이블 행을 참조", "artist_stats.artist_id"],
                ["1:N", "한 행에 여러 기록 연결", "작가 1명 : 통계 여러 날짜"],
                ["N:M", "양쪽 모두 여러 행 연결. 연결표 필요", "매거진 : 작가 = magazine_artists"],
                ["RLS", "행 단위 접근 제어", "내부 작가 원본을 브라우저에서 차단"],
                ["Upsert", "있으면 수정, 없으면 생성", "같은 작가·같은 날짜 통계 반영"],
            ],
            [24 * mm, 66 * mm, 78 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(P("<b>핵심 원칙</b>: Supabase가 공식 원본이다. Admin은 편집 UI, Sheets는 검수·조회 화면, Collector는 팔로워와 게시물 수를 모으는 별도 프로그램이다.", "KoCallout"))
    story.append(PageBreak())

    story += section("전체 데이터 흐름", "01 · Architecture")
    story.append(ArchitectureDiagram())
    story.append(Spacer(1, 5 * mm))
    story.append(P("Admin에서 작가·카테고리·협업 정보를 저장하면 Supabase에 반영된다. 웹사이트는 Supabase 원본 전체를 직접 노출하지 않고 서버의 공개 DTO를 거쳐 필요한 정보만 전달한다."))
    story.append(P("Collector는 Supabase에서 작가 목록과 최신 통계를 읽고 Instagram 수치를 수집한다. 검수 후 승인된 행만 <b>artist_stats</b>에 날짜별 스냅샷으로 저장한다."))
    story.append(P("Google Sheets는 두 역할을 가진다. Admin 관리 탭은 명시적인 Preview/Apply를 위한 일괄 편집 화면이고, collector_* 탭은 수집 결과 검수 화면이다. 셀을 수정했다고 즉시 DB가 바뀌지는 않는다.", "KoCallout"))
    story.append(Spacer(1, 4 * mm))
    story.append(
        info_table(
            ["구성요소", "읽는 데이터", "쓰는 데이터"],
            [
                ["웹사이트", "공개 작가·카테고리·통계·매거진", "클릭 로그·검색 로그"],
                ["Admin", "운영 DB 전체", "작가·분류·통계·협업·ToonBTI"],
                ["Collector", "작가와 최신 artist_stats", "승인된 artist_stats"],
                ["Sheets", "Export 및 Collector 결과", "Preview/Apply 요청의 입력"],
            ],
            [28 * mm, 70 * mm, 70 * mm],
        )
    )
    story.append(PageBreak())

    story += section("6개 도메인 분류", "02 · Domain Map")
    story.append(DomainMap())
    story.append(Spacer(1, 5 * mm))
    story.append(P("모든 테이블은 안정성을 위해 public 스키마에 유지한다. 대신 PostgreSQL 테이블 설명에 CORE, BUSINESS, EDITORIAL, TOONBTI, ANALYTICS, OPS 접두어를 기록했다."))
    story.append(
        info_table(
            ["도메인", "테이블 수", "책임"],
            [
                ["CORE", "3", "작가 프로필, 공개 카테고리, 날짜별 통계"],
                ["BUSINESS", "5", "연락처, 브랜드 업종, B2B 분석, 협업 이력"],
                ["EDITORIAL", "2", "매거진 글과 관련 작가 임베드"],
                ["TOONBTI", "4", "테스트·질문·경로·결과 추천"],
                ["ANALYTICS", "2", "작가 클릭과 검색 행동 로그"],
                ["OPS", "2", "Sheets 감사 로그와 마이그레이션 백업"],
            ],
            [30 * mm, 24 * mm, 114 * mm],
        )
    )
    story.append(PageBreak())

    story += section("CORE: 작가와 카테고리", "03 · Core")
    story.append(P("<b>artists</b>는 인투니의 중심 테이블이다. 여기에는 현재 프로필과 노출 설정만 저장하며, 시간에 따라 누적되는 팔로워 수는 넣지 않는다."))
    story.append(
        info_table(
            ["테이블", "중요 열", "설계 이유"],
            [
                ["categories", "id, name, sort_order", "작가 대표 카테고리 목록. 이름 중복 방지"],
                ["artists", "id, name, instagram_handle, main_category_id", "작가 프로필의 공식 원본"],
                ["artist_stats", "artist_id, recorded_date, followers, post_count", "작가별 날짜 기록을 계속 누적"],
            ],
            [30 * mm, 67 * mm, 71 * mm],
            header_color=CORE,
        )
    )
    story.append(P("<b>artists 주요 열 묶음</b>", "KoH3"))
    for text in [
        "식별: id, name, instagram_handle",
        "분류: main_category_id → categories.id",
        "공개 소개: bio, hashtags, search_tags, mood_tags, style_tags, topic_tags",
        "미디어: thumbnail_url, character_url, gallery_post_urls",
        "노출: show_on_site, show_growth_on_site, is_trending, hide_from_new",
        "운영: status(active/hidden/archived), sort_order, internal_memo",
    ]:
        story.append(bullet(text))
    story.append(P("instagram_handle은 @를 제거하고 소문자로 정규화하며 중복을 허용하지 않는다. 작가를 물리 삭제하기보다 archived 상태로 보관하는 것이 안전하다.", "KoCallout"))
    story.append(PageBreak())

    story += section("artist_stats 깊게 이해하기", "04 · Time Series")
    story.append(P("artist_stats의 한 행은 작가 한 명이 아니라 <b>작가 한 명의 특정 날짜 기록 한 개</b>다."))
    story.append(P("artist_id + recorded_date = 통계 스냅샷 한 행", "KoCode"))
    story.append(Spacer(1, 3 * mm))
    story.append(
        info_table(
            ["날짜", "스냅샷 수", "성격"],
            [
                ["2026-04-01", "149", "이전 주간 증가값에서 복원한 비교 기준값"],
                ["2026-07-05", "149", "수집·이관된 통계"],
                ["2026-07-06", "1", "개별 입력"],
                ["2026-07-09", "1", "개별 입력"],
            ],
            [35 * mm, 30 * mm, 103 * mm],
            header_color=CORE,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(P("현재 149명은 스냅샷 2개, 2명은 1개를 가진다. 통계가 하나도 없는 작가는 없다. 따라서 300은 작가 수가 아니라 모든 날짜 스냅샷의 합계다."))
    story.append(P("<b>증가 수와 증가율</b>", "KoH3"))
    story.append(P("작가 A: 7월 5일 10,000명 → 7월 12일 10,500명<br/>증가 수 = 500, 증가율 = 500 / 10,000 × 100 = 5%", "KoCode"))
    story.append(P("비교 기간은 4주로 고정하지 않는다. 실제로 존재하는 이전 기록과 최신 기록을 비교한다. 스냅샷이 하나뿐이면 증가 수와 증가율은 계산할 수 없으므로 null로 취급한다."))
    story.append(PageBreak())

    story += section("BUSINESS: 내부 운영과 협업", "05 · Business")
    story.append(
        info_table(
            ["테이블", "관계", "저장 내용"],
            [
                ["artist_contacts", "작가 1 : 0~1", "email, dm_available"],
                ["brand_categories", "독립 목록", "브랜드·캠페인 업종"],
                ["artist_recommended_brand_categories", "작가 N : M 업종", "작가에게 어울리는 브랜드 업종"],
                ["artist_b2b_profiles", "작가 1 : 0~1", "강점, 주의점, 브랜드 안전 등급"],
                ["artist_collaborations", "작가 1 : N", "브랜드, 연월, 링크, 내용, 성과"],
            ],
            [48 * mm, 38 * mm, 82 * mm],
            header_color=BUSINESS,
        )
    )
    story.append(P("<b>협업 이력 한 행의 구성</b>", "KoH3"))
    story.append(P("brand_name · brand_category_id · collaboration_year/month · post_url · content_summary · ad_disclosure_status · likes/comments/views"))
    story.append(P("같은 작가에게 같은 post_url은 중복 저장하지 않는다. 브랜드 업종이 삭제되어도 협업 기록은 남고 brand_category_id만 null이 된다."))
    story.append(P("현재 운영 데이터는 연락처 0건, 브랜드 업종 0건, B2B 0건, 협업 0건이다. 즉 구조는 준비됐지만 앞으로 운영자가 채워야 하는 영역이다.", "KoCallout"))
    story.append(PageBreak())

    story += section("EDITORIAL: 매거진과 작가 임베드", "06 · Editorial")
    story.append(P("<b>magazines</b>는 글 자체를 저장하고, <b>magazine_artists</b>는 글에서 소개할 작가를 연결한다."))
    story.append(
        info_table(
            ["테이블", "주요 열", "역할"],
            [
                ["magazines", "title, content, thumbnail_url, is_public, published_at", "매거진 본문과 공개 상태"],
                ["magazine_artists", "magazine_id, artist_id, sort_order", "관련 작가와 표시 순서"],
            ],
            [38 * mm, 78 * mm, 52 * mm],
            header_color=EDITORIAL,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(P("왜 magazine_artists가 필요한가?" , "KoH3"))
    for text in [
        "한 매거진에 여러 작가를 소개할 수 있다.",
        "한 작가가 여러 매거진에 등장할 수 있다.",
        "작가 이름과 프로필을 매거진 안에 복사하지 않아도 된다.",
        "sort_order로 임베드 표시 순서를 관리할 수 있다.",
    ]:
        story.append(bullet(text))
    story.append(P("현재 운영 DB의 magazines와 magazine_artists는 모두 0건이다. UI 기능은 존재하지만 운영 데이터가 아직 입력되지 않은 상태다.", "KoCallout"))
    story.append(PageBreak())

    story += section("TOONBTI: 질문·경로·결과", "07 · ToonBTI")
    story.append(
        info_table(
            ["테이블", "키", "역할"],
            [
                ["toon_tests", "id", "테스트 기본 정보, 공개 상태, 버전, 편집 초안 JSON"],
                ["toon_nodes", "test_id + node_key", "질문 또는 결과 노드"],
                ["toon_edges", "test_id + edge_key", "선택지에 따른 노드 이동"],
                ["toon_result_artists", "test_id + result_node_key + artist_id", "결과별 추천 작가와 순서"],
            ],
            [42 * mm, 48 * mm, 78 * mm],
            header_color=TOONBTI,
        )
    )
    story.append(P("노드와 경로는 테스트가 삭제되면 함께 삭제되는 CASCADE 관계다. 결과에 연결된 작가는 실수로 삭제되지 않도록 RESTRICT한다."))
    story.append(P("현재 네 테이블 모두 0건이다. 테스트 편집 UI에서 첫 초안을 저장하면 toon_tests를 시작으로 데이터가 생성된다."))
    story.append(PageBreak())

    story += section("ANALYTICS와 OPS", "08 · Logs & Operations")
    story.append(P("<b>ANALYTICS</b>는 사용자 행동, <b>OPS</b>는 시스템 운영 이력을 담당한다."))
    story.append(
        info_table(
            ["도메인", "테이블", "현재 행 수", "의미"],
            [
                ["ANALYTICS", "artist_event_logs", "1,685", "작가 클릭과 Instagram 이동"],
                ["ANALYTICS", "search_query_logs", "768", "사용자 검색어"],
                ["OPS", "sheet_sync_jobs", "2", "Export/Preview/Apply 감사 로그"],
                ["OPS", "migration_legacy_backup", "151", "이전 구조 복구용 JSON 백업"],
            ],
            [28 * mm, 48 * mm, 25 * mm, 67 * mm],
            header_color=OPS,
        )
    )
    story.append(P("로그는 append-only 성격이다. 현재 규모에서는 파티셔닝이 필요 없다. 수십만 건 이상으로 커지면 일별 집계, 보관 기한, 날짜 파티셔닝을 검토한다."))
    story.append(P("migration_legacy_backup은 화면용 활성 데이터가 아니지만 복구 증거다. 임의 삭제하지 않는다.", "KoCallout"))
    story.append(PageBreak())

    story += section("보안과 삭제 규칙", "09 · Security")
    story.append(P("내부 테이블은 RLS를 활성화하고 anon/authenticated 직접 읽기를 차단한다. 웹사이트는 서버의 service_role과 공개 DTO를 통해 허용된 열만 내려준다."))
    story.append(
        info_table(
            ["규칙", "뜻", "사용 예"],
            [
                ["ON DELETE RESTRICT", "연결 데이터가 있으면 삭제 차단", "작가와 통계·협업·추천 결과"],
                ["ON DELETE CASCADE", "부모 삭제 시 연결 행도 삭제", "매거진 연결, ToonBTI 내부 구조"],
                ["ON DELETE SET NULL", "기록은 유지하고 분류만 비움", "협업의 브랜드 카테고리"],
                ["Private DTO", "내부 열을 공개 응답에서 제외", "internal_memo, 연락처, B2B"],
            ],
            [42 * mm, 64 * mm, 62 * mm],
        )
    )
    story.append(P("service_role 키는 브라우저 코드, 공개 저장소, Sheets 셀에 넣으면 안 된다. Admin 세션 비밀과 Collector 재검증 비밀도 서버 환경변수로만 관리한다."))
    story.append(PageBreak())

    story += section("Google Sheets 15개 탭", "10 · Sheets")
    sheet_rows = [
        ["Admin", "categories", "Preview/Apply", "작가 카테고리"],
        ["Admin", "brand_categories", "Preview/Apply", "브랜드 업종"],
        ["Admin", "artists", "Preview/Apply", "작가 기본 정보"],
        ["Admin", "artist_stats", "전용 Preview/Apply", "날짜별 원시 통계"],
        ["Admin", "artist_contacts", "Preview/Apply", "내부 연락처"],
        ["Admin", "artist_collaborations", "Preview/Apply", "협업 이력"],
        ["Admin", "artist_b2b_profiles", "Preview/Apply", "B2B 분석"],
        ["조회", "followers_history", "읽기 전용", "작가 행 × 날짜 열"],
        ["조회", "posts_history", "읽기 전용", "작가 행 × 날짜 열"],
        ["Collector", "collector_latest", "검수", "이번 실행 최신 결과"],
        ["Collector", "collector_records", "검수", "누적 수집 기록"],
        ["Collector", "collector_failures", "검수", "실패와 원인"],
        ["Collector", "collector_top5", "보조", "증가 순위"],
        ["Collector", "collector_apply_log", "감사", "DB 적용 결과"],
        ["Collector", "collector_ignored_failures", "감사", "제외한 실패"],
    ]
    story.append(info_table(["그룹", "탭", "수정 방식", "용도"], sheet_rows, [26 * mm, 48 * mm, 42 * mm, 52 * mm], header_color=BUSINESS))
    story.append(P("followers_history와 posts_history는 artist_stats를 가로로 펼친 조회용 피벗이다. Export할 때 재생성되므로 직접 입력 원본으로 사용하지 않는다.", "KoCallout"))
    story.append(PageBreak())

    story += section("Collector 주간 운영", "11 · Weekly Workflow")
    steps = [
        ["1", "Update New Artists", "Supabase 작가와 최신 통계를 Collector로 가져온다."],
        ["2", "Collect All", "Instagram 팔로워와 게시물 수를 날짜별로 수집한다."],
        ["3", "검수", "collector_latest, failures, 증가 수를 확인한다."],
        ["4", "재수집", "잘못된 핸들·실패·비정상 값을 수정한다."],
        ["5", "승인", "적용할 성공 행만 approve_for_update로 표시한다."],
        ["6", "Apply Approved", "artist_stats에 artist_id + recorded_date로 upsert한다."],
        ["7", "재검증", "웹사이트 통계 캐시를 갱신한다."],
        ["8", "Sheets Export", "followers_history와 posts_history 날짜 열을 갱신한다."],
    ]
    story.append(info_table(["순서", "작업", "확인할 내용"], steps, [18 * mm, 48 * mm, 102 * mm], header_color=ANALYTICS))
    story.append(P("Collector 경로: C:\\Users\\user\\Desktop\\Projects Files\\intooni_Collect", "KoCode"))
    story.append(P("공식 원본은 날짜별 followers와 post_count다. 증가 수·증가율은 두 스냅샷을 비교해 계산하며 별도 공식 열로 중복 저장하지 않는다."))
    story.append(PageBreak())

    story += section("현재 운영 데이터 진단", "12 · Data Audit")
    story.append(
        info_table(
            ["항목", "입력 수", "151명 대비", "해석"],
            [
                ["프로필 이미지", "139", "92.1%", "대부분 준비"],
                ["캐릭터 이미지", "114", "75.5%", "37명 보강 가능"],
                ["대표 게시물", "147", "97.4%", "거의 완료"],
                ["해시태그", "149", "98.7%", "거의 완료"],
                ["검색 태그", "131", "86.8%", "20명 보강 가능"],
                ["분위기 태그", "93", "61.6%", "분석 작업 필요"],
                ["그림체 태그", "92", "60.9%", "분석 작업 필요"],
                ["주제 태그", "90", "59.6%", "분석 작업 필요"],
                ["소개문 bio", "3", "2.0%", "가장 큰 보강 과제"],
            ],
            [40 * mm, 25 * mm, 28 * mm, 75 * mm],
            header_color=CORE,
        )
    )
    story.append(P("작가명·인스타 계정 공란은 0건, 정규화 후 중복 계정도 0건이다. 구조 안정성보다 콘텐츠 완성도를 높이는 일이 다음 우선순위다."))
    story.append(PageBreak())

    story += section("SQL 실습 1: 통계 조회", "13 · SQL Lab")
    story.append(P("아래 쿼리는 데이터를 변경하지 않는 SELECT 예제다."))
    story.append(P("""select a.name, a.instagram_handle,<br/>       s.recorded_date, s.followers, s.post_count<br/>from public.artist_stats s<br/>join public.artists a on a.id = s.artist_id<br/>order by a.name, s.recorded_date;""", "KoCode"))
    story.append(P("작가별 최신 통계", "KoH3"))
    story.append(P("""select distinct on (s.artist_id)<br/>       a.name, s.recorded_date, s.followers, s.post_count<br/>from public.artist_stats s<br/>join public.artists a on a.id = s.artist_id<br/>order by s.artist_id, s.recorded_date desc;""", "KoCode"))
    story.append(P("통계가 2개 미만인 작가", "KoH3"))
    story.append(P("""select a.name, count(s.id) as snapshot_count<br/>from public.artists a<br/>left join public.artist_stats s on s.artist_id = a.id<br/>group by a.id, a.name<br/>having count(s.id) &lt; 2<br/>order by a.name;""", "KoCode"))
    story.append(PageBreak())

    story += section("SQL 실습 2: 관계 조회", "14 · SQL Lab")
    story.append(P("매거진과 관련 작가", "KoH3"))
    story.append(P("""select m.title, a.name as artist_name, ma.sort_order<br/>from public.magazine_artists ma<br/>join public.magazines m on m.id = ma.magazine_id<br/>join public.artists a on a.id = ma.artist_id<br/>order by m.published_at desc, ma.sort_order;""", "KoCode"))
    story.append(P("작가별 협업 이력", "KoH3"))
    story.append(P("""select a.name, c.brand_name, c.collaboration_year,<br/>       c.collaboration_month, c.post_url, c.content_summary<br/>from public.artist_collaborations c<br/>join public.artists a on a.id = c.artist_id<br/>order by a.name, c.collaboration_year desc,<br/>         c.collaboration_month desc nulls last;""", "KoCode"))
    story.append(P("DB 도메인 분류 확인", "KoH3"))
    story.append(P("""select table_name,<br/>       obj_description(format('public.%I', table_name)::regclass)<br/>from information_schema.tables<br/>where table_schema = 'public' and table_type = 'BASE TABLE';""", "KoCode"))
    story.append(PageBreak())

    story += section("전체 테이블 사전", "15 · Appendix")
    dictionary_rows = [
        ["CORE", "categories", "id, name, sort_order, created_at, updated_at"],
        ["CORE", "artists", "id, name, instagram_handle, main_category_id, bio, tags, media, visibility, status, memo, timestamps"],
        ["CORE", "artist_stats", "id, artist_id, recorded_date, followers, post_count, timestamps"],
        ["BUSINESS", "artist_contacts", "artist_id, email, dm_available, timestamps"],
        ["BUSINESS", "brand_categories", "id, name, sort_order, timestamps"],
        ["BUSINESS", "artist_recommended_brand_categories", "artist_id, brand_category_id, created_at"],
        ["BUSINESS", "artist_b2b_profiles", "artist_id, strengths, cautions, brand_safety_grade, timestamps"],
        ["BUSINESS", "artist_collaborations", "id, artist_id, brand, date, URL, summary, disclosure, metrics, timestamps"],
        ["EDITORIAL", "magazines", "id, title, tag, content, media, views, publication, timestamps"],
        ["EDITORIAL", "magazine_artists", "magazine_id, artist_id, sort_order, created_at"],
        ["TOONBTI", "toon_tests", "id, slug, title, status, version, start_node_key, draft, timestamps"],
        ["TOONBTI", "toon_nodes", "test_id, node_key, node_type, title, description, image_url, order, config, timestamps"],
        ["TOONBTI", "toon_edges", "test_id, edge_key, from/to_node_key, option_label, order, config, timestamps"],
        ["TOONBTI", "toon_result_artists", "test_id, result_node_key, artist_id, sort_order, created_at"],
        ["ANALYTICS", "artist_event_logs", "id, artist_id, event_type, created_at"],
        ["ANALYTICS", "search_query_logs", "id, query, created_at"],
        ["OPS", "sheet_sync_jobs", "id, job_type, status, spreadsheet, requester, timing, summary, error, timestamps"],
        ["OPS", "migration_legacy_backup", "scope, row_key, payload JSON, backed_up_at"],
    ]
    story.append(info_table(["도메인", "테이블", "열 요약"], dictionary_rows, [28 * mm, 58 * mm, 82 * mm], header_color=INK))
    story.append(PageBreak())

    story += section("운영 체크리스트", "16 · Checklist")
    checklist = [
        "작가 신규 등록 시 instagram_handle 중복과 대표 카테고리를 확인한다.",
        "통계는 artists가 아니라 artist_stats에 날짜별로 넣는다.",
        "Collector 결과는 검수·승인 후에만 Apply한다.",
        "Sheets 수정은 Preview를 통과한 뒤 Apply한다.",
        "followers_history/posts_history는 직접 수정하지 않는다.",
        "협업은 작가당 여러 행으로 기록하고 post_url 중복을 피한다.",
        "내부 메모·연락처·B2B 정보가 공개 DTO에 포함되지 않았는지 확인한다.",
        "작가는 물리 삭제보다 archived 상태를 우선한다.",
        "migration_legacy_backup은 복구 증거로 유지한다.",
        "새 마이그레이션 전에는 백업과 읽기 전용 검증을 먼저 수행한다.",
    ]
    for item in checklist:
        story.append(P(f"□ {item}", "KoBody"))
    story.append(Spacer(1, 6 * mm))
    story.append(P("현재 적용 상태", "KoH3"))
    story.append(bullet("010 도메인 분류: 운영 Supabase에 적용 완료, 18개 테이블 확인"))
    story.append(bullet("009 인덱스 정돈: SQL 파일 준비 완료, 운영 적용 전"))
    story.append(bullet("전체 앱 검증: 타입 검사, 129개 테스트, 인코딩, 린트, 프로덕션 빌드 통과"))
    story.append(P("구조를 다시 뜯어고치는 것보다, 현재 정규화 구조를 유지하면서 콘텐츠 입력·통계 누적·운영 절차를 안정화하는 것이 다음 단계다.", "KoCallout"))

    return story


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=19 * mm,
        title="인투니 데이터베이스 학습 및 운영 가이드",
        author="INTOONI",
        subject="Supabase DB, Google Sheets, Collector 학습 문서",
    )
    doc.build(build_story(), onFirstPage=cover, onLaterPages=header_footer)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
