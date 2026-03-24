"""seed k_content packages/places

Revision ID: 009
Revises: 008
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

K_DATA = [
    {
        "package": {
            "package_id": "KPOP_01",
            "category": "KPOP",
            "title_en": "BTS: The Eternal Youth",
            "title_ko": "BTS: 영원한 화양연화",
            "tags": "BTS, ARMY, Gangnam, HYBE",
        },
        "places": [
            {"name_en": "Yoojung Sikdang", "name_ko": "유정식당", "lat": 37.5194, "lng": 127.0345, "desc": "BTS's favorite restaurant during trainee days. Famous for Black Pork Stone Bowl Bibimbap.", "must": "Try the 'Bangtan Bap' (Black Pork Bibimbap)."},
            {"name_en": "Hakdong Park", "name_ko": "학동공원", "lat": 37.5135, "lng": 127.0243, "desc": "A quiet hideout where BTS members gathered to talk and practice before their debut.", "must": "Sit on the benches and enjoy the peaceful atmosphere."},
            {"name_en": "Old Big Hit Building", "name_ko": "빅히트 구사옥", "lat": 37.5131, "lng": 127.0221, "desc": "The historic building near Hakdong Station where BTS started. Covered in fan graffiti.", "must": "Take a photo of the iconic fan messages on the walls."},
            {"name_en": "HYBE Insight", "name_ko": "하이브 인사이트", "lat": 37.5233, "lng": 126.9673, "desc": "Museum located in HYBE headquarters showcasing the music and history of HYBE artists.", "must": "Check the exhibition schedule and book in advance."},
            {"name_en": "GangnamDol (K-Star Road)", "name_ko": "강남돌 (K-Star Road)", "lat": 37.5278, "lng": 127.0402, "desc": "A street in Apgujeong with large bear-shaped art toys representing K-Pop groups.", "must": "Find and take a photo with the giant BTS bear doll."},
            {"name_en": "Line Friends Square Sinsa", "name_ko": "라인프렌즈 스퀘어 신사", "lat": 37.5204, "lng": 127.0223, "desc": "Large flagship store featuring all BT21 characters created by BTS.", "must": "Shop for exclusive BT21 merch and take photos at the character zones."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_02",
            "category": "KPOP",
            "title_en": "BLACKPINK: Born Pink Luxury",
            "title_ko": "블랙핑크: 힙&럭셔리",
            "tags": "BLACKPINK, YG, Luxury, Trend",
        },
        "places": [
            {"name_en": "the SameE", "name_ko": "더 세임E", "lat": 37.5482, "lng": 126.9142, "desc": "Cafe and official MD shop located right across from the YG Entertainment building.", "must": "Watch the YG office from the cafe and browse official merch."},
            {"name_en": "Tamburins Flagship Store", "name_ko": "탬버린즈 플래그십", "lat": 37.5235, "lng": 127.0215, "desc": "Cosmetic brand modeled by Jennie, famous for its artistic interior and unique scents.", "must": "Experience the sensory exhibition-like shop interior."},
            {"name_en": "Haus Dosan (Gentle Monster)", "name_ko": "하우스 도산", "lat": 37.5262, "lng": 127.0361, "desc": "Iconic eyewear flagship store often collaborating with BLACKPINK members.", "must": "Take photos with the surreal art installations."},
            {"name_en": "The Hyundai Seoul", "name_ko": "더현대 서울", "lat": 37.5259, "lng": 126.9283, "desc": "Seoul's trendiest mall where BLACKPINK members' luxury brand pop-ups frequently open.", "must": "Visit the luxury fashion zone or the Sound Forest garden."},
            {"name_en": "Musinsa Empty Seongsu", "name_ko": "무신사 엠프티 성수", "lat": 37.5413, "lng": 127.0566, "desc": "Curated shop with edgy designer brands that fit the BLACKPINK style.", "must": "Explore unique and avant-garde Korean fashion labels."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_03",
            "category": "KPOP",
            "title_en": "SEVENTEEN & Stray Kids: Performance Energy",
            "title_ko": "세븐틴&스키즈: 퍼포먼스 에너지",
            "tags": "SEVENTEEN, Stray Kids, JYP, Performance",
        },
        "places": [
            {"name_en": "JYP Soul Cup", "name_ko": "JYP 소울컵", "lat": 37.5126, "lng": 127.1295, "desc": "JYP Entertainment's official organic cafe featuring artist-themed goods.", "must": "Try the organic soft-serve ice cream often enjoyed by idols."},
            {"name_en": "KSPO DOME", "name_ko": "올림픽공원 체조경기장", "lat": 37.5205, "lng": 127.1274, "desc": "The 'Holy Land' of K-Pop concerts where legends perform.", "must": "Take a photo in front of the stadium like the idols do after concerts."},
            {"name_en": "Seongnae-dong Jjukkumi Alley", "name_ko": "성내동 주꾸미 골목", "lat": 37.5298, "lng": 127.1322, "desc": "An alley near JYP building famous for spicy baby octopus, a favorite of Stray Kids.", "must": "Have a meal at one of the spicy jjukkumi restaurants."},
            {"name_en": "Seoul Forest Carat Benches", "name_ko": "서울숲 캐럿 벤치", "lat": 37.5443, "lng": 127.0441, "desc": "Special benches in Seoul Forest donated by fans with SEVENTEEN members' names.", "must": "Find and sit on your favorite member's name bench."},
            {"name_en": "WithMuu Yongsan", "name_ko": "위드뮤 용산점", "lat": 37.5298, "lng": 126.9647, "desc": "Large K-Pop store with dedicated corners for SEVENTEEN and other Pledis artists.", "must": "Buy official lightsticks and the latest albums."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_04",
            "category": "KPOP",
            "title_en": "NewJeans & IVE: Gen Z Trend",
            "title_ko": "뉴진스&아이브: 하이틴 서울",
            "tags": "NewJeans, IVE, Y2K, Seongsu, Hannam",
        },
        "places": [
            {"name_en": "NUDAKE Seongsu/Dosan", "name_ko": "누데이크", "lat": 37.5453, "lng": 127.0522, "desc": "Surreal dessert cafe famous for NewJeans rabbit cake collaborations.", "must": "Try the unique Peak cake or rabbit-themed desserts."},
            {"name_en": "Mardi Mercredi Hannam", "name_ko": "마르디 메크르디 본점", "lat": 37.5372, "lng": 127.0012, "desc": "The fashion brand that became a global hit after being worn by NewJeans and IVE.", "must": "Shop for the signature flower-printed t-shirts."},
            {"name_en": "Photoism Box Hongdae", "name_ko": "포토이즘 박스 홍대", "lat": 37.5552, "lng": 126.9231, "desc": "The most popular self-photo booth for idol collaboration frames.", "must": "Take a photo with the latest K-Pop artist collaboration frame."},
            {"name_en": "Beaker Hannam", "name_ko": "비이커 한남", "lat": 37.5378, "lng": 127.0008, "desc": "A multi-brand shop where 4th gen idols are frequently spotted shopping for outfits.", "must": "Discover trendy Korean and global designer labels."},
            {"name_en": "Amore Seongsu", "name_ko": "아모레 성수", "lat": 37.5448, "lng": 127.0594, "desc": "Experience creating custom foundation and lip products used by idol makeup artists.", "must": "Book a session for a custom makeup experience."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_05",
            "category": "KPOP",
            "title_en": "SM: Kwangya Express",
            "title_ko": "SM: 광야 익스프레스",
            "tags": "SM, aespa, NCT, Kwangya, Seongsu",
        },
        "places": [
            {"name_en": "KWANGYA@SEOUL", "name_ko": "광야@서울", "lat": 37.5443, "lng": 127.0441, "desc": "SM's flagship store with a futuristic transparent digital floor and official goods.", "must": "Experience the digital media art floor and shop for NCT/aespa merch."},
            {"name_en": "Seoul Forest Park", "name_ko": "서울숲 공원", "lat": 37.5441, "lng": 127.0401, "desc": "The park next to SM building where idols often walk and film contents.", "must": "Take a walk and find spots seen in NCT or aespa's 'self-content'."},
            {"name_en": "Rain Report Seongsu", "name_ko": "레인리포트 성수", "lat": 37.5451, "lng": 127.0511, "desc": "A unique concept cafe with artificial rain, matching the SM 'Kwangya' aesthetic.", "must": "Enjoy the unique rainy atmosphere with coffee and desserts."},
            {"name_en": "Kwangya Club Spots", "name_ko": "광야 클럽 스폿", "lat": 37.5445, "lng": 127.0445, "desc": "Various spots around Seongsu linked to SM artist events and app-based missions.", "must": "Check the Kwangya Club app for active pop-up event locations."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_06",
            "category": "KPOP",
            "title_en": "Experience: Become a Star",
            "title_ko": "아이돌 직접 체험하기",
            "tags": "Experience, Dance, Recording, Idol-life",
        },
        "places": [
            {"name_en": "HiKR Ground", "name_ko": "하이커 그라운드", "lat": 37.5685, "lng": 126.9815, "desc": "Experience K-Tourism with high-quality MV sets where you can film your own dance.", "must": "Film a K-Pop dance challenge on the colorful subway or spaceship sets."},
            {"name_en": "1MILLION Dance Studio", "name_ko": "원밀리언 댄스 스튜디오", "lat": 37.5452, "lng": 127.0528, "desc": "World-famous studio where you can take 1-day classes from star choreographers.", "must": "Join a beginner-friendly 1-day dance class."},
            {"name_en": "YGX Academy", "name_ko": "YGX 아카데미", "lat": 37.5488, "lng": 126.9148, "desc": "Dance academy under YG where BLACKPINK's choreographers teach.", "must": "Check for special workshops or 1-day classes."},
            {"name_en": "Su Noraebang Hongdae", "name_ko": "수노래방 홍대", "lat": 37.5562, "lng": 126.9242, "desc": "The iconic singing room with glass walls and the latest K-Pop soundtracks.", "must": "Sing your favorite K-Pop hits with professional-style mics."},
            {"name_en": "King Studio", "name_ko": "킹스튜디오", "lat": 37.5242, "lng": 127.0388, "desc": "Record your own K-Pop song with professional equipment used by actual singers.", "must": "Take home your own recorded and tuned music file."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_07",
            "category": "KPOP",
            "title_en": "Hongdae: Heart of Fandom",
            "title_ko": "홍대: 팬덤 문화의 중심",
            "tags": "Hongdae, Busking, Album, Fans",
        },
        "places": [
            {"name_en": "AK PLAZA WithMuu", "name_ko": "AK플라자 위드뮤", "lat": 37.5574, "lng": 126.9242, "desc": "The largest album and goods shop in Hongdae with frequent lucky draw events.", "must": "Try the album lucky draw for exclusive photocards."},
            {"name_en": "Hongdae Busking Street", "name_ko": "홍대 걷고싶은거리", "lat": 37.5555, "lng": 126.9235, "desc": "The center of K-Pop street performances where cover dance teams perform daily.", "must": "Watch high-energy K-Pop dance covers in the evening."},
            {"name_en": "Cafe LovinHer", "name_ko": "카페 러빈허", "lat": 37.5582, "lng": 126.9275, "desc": "A representative cafe for idol birthday events and beautiful floral photo spots.", "must": "Check if there's a birthday event for your favorite idol."},
            {"name_en": "M2U Record Sinchon", "name_ko": "엠투유레코드 신촌", "lat": 37.5562, "lng": 126.9365, "desc": "Historic record shop where many idol fan-sign events take place.", "must": "Check for signed albums or upcoming fan event schedules."},
            {"name_en": "Object Seogyo", "name_ko": "오브젝트 서교", "lat": 37.5568, "lng": 126.9288, "desc": "Popular shop for 'Dakku' items to decorate your idol photocards and journals.", "must": "Customize your own photocard holder with cute stickers."},
        ],
    },
    {
        "package": {
            "package_id": "KPOP_08",
            "category": "KPOP",
            "title_en": "K-OST & Healing: The Voice of Korea",
            "title_ko": "K-OST & 감성 힐링 서울",
            "tags": "IU, OST, Healing, Retro, Seoul",
        },
        "places": [
            {"name_en": "Hyundai Card Music Library", "name_ko": "현대카드 뮤직 라이브러리", "lat": 37.5352, "lng": 127.0012, "desc": "Listen to rare LPs of classic K-Pop and OSTs in a beautiful architectural space.", "must": "Listen to a classic vinyl on a turntable."},
            {"name_en": "Haneul Park", "name_ko": "하늘공원", "lat": 37.5682, "lng": 126.8852, "desc": "Beautiful silver grass fields seen in many emotional K-Pop music videos.", "must": "Walk the reed paths at sunset for MV-like photos."},
            {"name_en": "Euljiro Pyeonggyun-yul", "name_ko": "을지로 평균율", "lat": 37.5642, "lng": 126.9922, "desc": "Retro LP bar where you can enjoy Korean indie and city pop music.", "must": "Enjoy a quiet evening with analog music and a drink."},
            {"name_en": "Piknic", "name_ko": "피크닉", "lat": 37.5582, "lng": 126.9782, "desc": "A cultural space and cafe favored by artists like IU for its healing atmosphere.", "must": "Visit the gallery exhibition and enjoy the quiet garden cafe."},
            {"name_en": "Seochon Alley", "name_ko": "서촌 골목길", "lat": 37.5802, "lng": 126.9702, "desc": "Charming old alleys where IU filmed her 'Flower Bookmark' album art.", "must": "Walk through the traditional alleys and visit the retro shops."},
        ],
    },
]

def upgrade() -> None:
    bind = op.get_bind()
    package_rows = []
    place_rows = []

    for idx, item in enumerate(K_DATA, start=1):
        pkg = dict(item["package"])
        pkg.pop("package_id", None)
        package_rows.append(
            {
                "id": idx,
                "category": pkg["category"],
                "title_en": pkg["title_en"],
                "title_ko": pkg.get("title_ko"),
                "description_en": pkg.get("description_en"),
                "image_url": pkg.get("image_url"),
                "tags": pkg.get("tags"),
            }
        )

        for p in item.get("places", []):
            place_rows.append(
                {
                    "package_id": idx,
                    "name_en": p["name_en"],
                    "name_ko": p.get("name_ko"),
                    "lat": p["lat"],
                    "lng": p["lng"],
                    "description_en": p.get("desc"),
                    "must_do_en": p.get("must"),
                }
            )

    package_table = sa.table(
        "k_content_packages",
        sa.column("id", sa.Integer()),
        sa.column("category", sa.String()),
        sa.column("title_en", sa.String()),
        sa.column("title_ko", sa.String()),
        sa.column("description_en", sa.Text()),
        sa.column("image_url", sa.String()),
        sa.column("tags", sa.String()),
    )
    place_table = sa.table(
        "k_content_places",
        sa.column("package_id", sa.Integer()),
        sa.column("name_en", sa.String()),
        sa.column("name_ko", sa.String()),
        sa.column("lat", sa.Numeric()),
        sa.column("lng", sa.Numeric()),
        sa.column("description_en", sa.Text()),
        sa.column("must_do_en", sa.Text()),
    )

    # Idempotent package seed for safety in partially-seeded environments.
    for row in package_rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO k_content_packages
                (id, category, title_en, title_ko, description_en, image_url, tags)
                VALUES (:id, :category, :title_en, :title_ko, :description_en, :image_url, :tags)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            row,
        )

    # Re-run safe: overwrite places for target packages.
    ids = list(range(1, len(K_DATA) + 1))
    ids_param = sa.bindparam("ids", expanding=True)
    bind.execute(sa.text("DELETE FROM k_content_places WHERE package_id IN :ids").bindparams(ids_param), {"ids": ids})
    op.bulk_insert(place_table, place_rows)


def downgrade() -> None:
    ids = list(range(1, len(K_DATA) + 1))
    bind = op.get_bind()
    ids_param = sa.bindparam("ids", expanding=True)
    bind.execute(
        sa.text("DELETE FROM k_content_places WHERE package_id IN :ids").bindparams(ids_param),
        {"ids": ids},
    )
    bind.execute(
        sa.text("DELETE FROM k_content_packages WHERE id IN :ids").bindparams(ids_param),
        {"ids": ids},
    )
