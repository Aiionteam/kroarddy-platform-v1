"""seed additional kdrama/kmovie packages

Revision ID: 010
Revises: 009
Create Date: 2026-03-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EXTRA_PACKAGES = [
    {"id": 9, "category": "KDRAMA", "title_ko": "도깨비", "title_en": "Goblin", "description_en": None, "image_url": None, "tags": "#GongYoo #Fantasy #Romance"},
    {"id": 10, "category": "KDRAMA", "title_ko": "오징어 게임", "title_en": "Squid Game", "description_en": None, "image_url": None, "tags": "#Netflix #Survival #Thriller"},
    {"id": 11, "category": "KDRAMA", "title_ko": "사랑의 불시착", "title_en": "Crash Landing on You", "description_en": None, "image_url": None, "tags": "#HyunBin #SonYeJin #Romance"},
    {"id": 12, "category": "KDRAMA", "title_ko": "킹덤", "title_en": "Kingdom", "description_en": None, "image_url": None, "tags": "#Zombies #Historical #Horror"},
    {"id": 13, "category": "KMOVIE", "title_ko": "기생충", "title_en": "Parasite", "description_en": None, "image_url": None, "tags": "#Oscar #BongJoonHo #SocialIssues"},
    {"id": 14, "category": "KDRAMA", "title_ko": "선재 업고 튀어", "title_en": "Lovely Runner", "description_en": None, "image_url": None, "tags": "#ByeonWooSeok #TimeSlip #Youth"},
    {"id": 15, "category": "KDRAMA", "title_ko": "호텔 델루나", "title_en": "Hotel Del Luna", "description_en": None, "image_url": None, "tags": "#IU #Fantasy #Mystery"},
    {"id": 16, "category": "KDRAMA", "title_ko": "킹더랜드", "title_en": "King the Land", "description_en": None, "image_url": None, "tags": "#JunHo #Yoona #Luxury"},
    {"id": 17, "category": "KDRAMA", "title_ko": "미스터 션샤인", "title_en": "Mr. Sunshine", "description_en": None, "image_url": None, "tags": "#History #LeeByungHun #KimTaeri"},
    {"id": 18, "category": "KDRAMA", "title_ko": "태양의 후예", "title_en": "Descendants of the Sun", "description_en": None, "image_url": None, "tags": "#SongJoongKi #SongHyeKyo #Military"},
    {"id": 19, "category": "KDRAMA", "title_ko": "눈물의 여왕", "title_en": "Queen of Tears", "description_en": None, "image_url": None, "tags": "#KimSooHyun #KimJiWon #Chaebol"},
    {"id": 20, "category": "KMOVIE", "title_ko": "왕과 사는 남자", "title_en": "The Man Who Lives with the King", "description_en": None, "image_url": None, "tags": "#GangDongWon #YooHaeJin #History"},
]

EXTRA_PLACES = [
    {
        "package_id": 9,
        "name_ko": "주문진 방파제",
        "name_en": "Jumunjin Breakwater",
        "lat": 37.8917,
        "lng": 128.8315,
        "description_en": "The iconic spot where the Goblin and Eun-tak first met with a bouquet of buckwheat flowers.",
        "must_do_en": "Take a photo with a red scarf and a buckwheat bouquet like the main characters.",
    },
    {
        "package_id": 9,
        "name_ko": "운현궁 양관",
        "name_en": "Unhyeongung Yanggwan",
        "lat": 37.5756,
        "lng": 126.9882,
        "description_en": "The beautiful Western-style exterior of the house where the Goblin and the Grim Reaper lived together.",
        "must_do_en": "Admire the exotic architecture and take a classic photo in front of the 'Goblin's House'.",
    },
    {
        "package_id": 9,
        "name_ko": "배다리 헌책방 거리",
        "name_en": "Baedari Secondhand Bookstore Alley",
        "lat": 37.4789,
        "lng": 126.6345,
        "description_en": "A nostalgic alley with the yellow 'Hanmi Bookstore' where Kim Shin waited for Eun-tak.",
        "must_do_en": "Walk through the yellow-themed street and enjoy the analog atmosphere of old books.",
    },
    {
        "package_id": 9,
        "name_ko": "미리내 성지",
        "name_en": "Mirinae Holy Site",
        "lat": 37.0725,
        "lng": 127.2285,
        "description_en": "The solemn and mystical cathedral where Eun-tak blew out a candle to summon the Goblin.",
        "must_do_en": "Experience the peaceful and divine atmosphere inside the historic cathedral.",
    },
    {
        "package_id": 9,
        "name_ko": "덕수궁 돌담길",
        "name_en": "Deoksugung Stone Wall Path",
        "lat": 37.5658,
        "lng": 126.9751,
        "description_en": "The scenic path where the Goblin and the Grim Reaper first confirmed each other's existence.",
        "must_do_en": "Stroll along the beautiful stone wall and recall the mysterious mood of the drama.",
    },
    {
        "package_id": 9,
        "name_ko": "광화문 미진",
        "name_en": "Mijin (Gwanghwamun)",
        "lat": 37.5709,
        "lng": 126.9791,
        "description_en": "A historic Michelin-listed restaurant specializing in Buckwheat Soba, fitting for the Goblin's love for buckwheat.",
        "must_do_en": "Taste the authentic Buckwheat Soba, the soul food that represents the Goblin's identity.",
    },
    {
        "package_id": 9,
        "name_ko": "고향막국수",
        "name_en": "Gohyang Makguksu",
        "lat": 37.5852,
        "lng": 128.3288,
        "description_en": "Located in Bongpyeong, the filming site of the buckwheat fields, offering various traditional buckwheat dishes.",
        "must_do_en": "Try 'Buckwheat Jeon' and 'Noodles' while feeling the vibe of the vast buckwheat fields.",
    },
    {
        "package_id": 10,
        "name_ko": "백운시장 팔도유통",
        "name_en": "Baegun Market (Paldo)",
        "lat": 37.6521,
        "lng": 127.0274,
        "description_en": "The actual fish shop in the traditional market where Sang-woo's mother worked, reflecting the hard-working lives of the characters.",
        "must_do_en": "Explore the traditional market alley and feel the realistic everyday atmosphere of the series.",
    },
    {
        "package_id": 10,
        "name_ko": "남산공원 소월로 계단",
        "name_en": "Namsan Park Stairs",
        "lat": 37.5558,
        "lng": 126.9814,
        "description_en": "The dramatic stairs where Gi-hun was dropped off in the rain after winning the final game, facing a cold reality.",
        "must_do_en": "Play 'Rock-Paper-Scissors' to climb the stairs and take a photo with the N Seoul Tower in the background.",
    },
    {
        "package_id": 10,
        "name_ko": "혜화동 달고나 거리",
        "name_en": "Hyehwa-dong Dalgona Street",
        "lat": 37.5822,
        "lng": 127.0019,
        "description_en": "A famous street in Daehak-ro where you can try the 'Dalgona Challenge,' the most viral survival game from the show.",
        "must_do_en": "Try to carve out the shape from the melted sugar without breaking it, just like Gi-hun did.",
    },
    {
        "package_id": 10,
        "name_ko": "월미 테마파크",
        "name_en": "Wolmi Theme Park",
        "lat": 37.4764,
        "lng": 126.5986,
        "description_en": "A vintage amusement park that captures the eerie yet colorful vibe of the game's playground setting.",
        "must_do_en": "Ride the 'Disco Pang Pang' or the Ferris wheel to experience the thrilling and retro atmosphere.",
    },
    {
        "package_id": 10,
        "name_ko": "쌍문동 해등로 골목",
        "name_en": "Ssangmun-dong Alley",
        "lat": 37.6515,
        "lng": 127.0305,
        "description_en": "The residential area where Gi-hun lived, showing the nostalgic and humble side of Seoul's neighborhood.",
        "must_do_en": "Walk through the narrow alleys and find the small details that remind you of Gi-hun’s home.",
    },
    {
        "package_id": 10,
        "name_ko": "인사동 쌈지길 달고나",
        "name_en": "Insadong Ssamzigil Dalgona",
        "lat": 37.5743,
        "lng": 126.9848,
        "description_en": "A popular cultural spot in Seoul where you can find premium Dalgona kits and professional sugar-crafting experts.",
        "must_do_en": "Buy a Dalgona DIY kit as a souvenir or watch the masters create intricate sugar shapes.",
    },
    {
        "package_id": 11,
        "name_ko": "포천 한탄강 하늘다리",
        "name_en": "Pocheon Hantan River Sky Bridge",
        "lat": 38.1066,
        "lng": 127.2078,
        "description_en": "The scenic bridge where Ri Jeong-hyeok and Yoon Se-ri realized their fateful encounter in Switzerland.",
        "must_do_en": "Walk across the bridge and enjoy the breathtaking canyon view, recalling the couple's destiny.",
    },
    {
        "package_id": 11,
        "name_ko": "영종도 선녀바위 해변",
        "name_en": "Seonnyeo Bawi Beach",
        "lat": 37.4485,
        "lng": 126.3712,
        "description_en": "The beach where Ri Jeong-hyeok first stepped onto South Korean soil after traveling through the tunnel.",
        "must_do_en": "Stroll along the shore at sunset and imagine the dramatic arrival of the North Korean officer.",
    },
    {
        "package_id": 11,
        "name_ko": "충주 탄금호 무지개길",
        "name_en": "Chungju Tangeum Lake Rainbow Road",
        "lat": 37.0094,
        "lng": 127.8861,
        "description_en": "A romantic floating path where the couple took a night stroll, famous for its colorful evening lights.",
        "must_do_en": "Walk the illuminated path at night to experience the same romantic atmosphere as the drama.",
    },
    {
        "package_id": 11,
        "name_ko": "BBQ 치킨 헬리오시티점",
        "name_en": "BBQ Chicken Helio City",
        "lat": 37.4981,
        "lng": 127.1089,
        "description_en": "The actual filming location where the North Korean soldiers first tasted and fell in love with South Korean chicken.",
        "must_do_en": "Order the 'Golden Olive Chicken' and enjoy the exact same menu the soldiers raved about.",
    },
    {
        "package_id": 11,
        "name_ko": "청담동 명품거리",
        "name_en": "Cheongdam-dong Fashion Street",
        "lat": 37.5250,
        "lng": 127.0425,
        "description_en": "The area representing Yoon Se-ri's high-end lifestyle as a successful CEO of 'Seri's Choice'.",
        "must_do_en": "Experience the luxury vibe of Seoul and take photos in front of stylish flagship stores.",
    },
    {
        "package_id": 11,
        "name_ko": "충주 중앙탑 사적공원",
        "name_en": "Chungju Jungangtap Park",
        "lat": 36.9926,
        "lng": 127.8633,
        "description_en": "The park where the North Korean soldiers and Yoon Se-ri had a tearful yet warm reunion in South Korea.",
        "must_do_en": "Have a picnic in the park and find the specific spots where the characters shared their friendship.",
    },
    {
        "package_id": 12,
        "name_ko": "창덕궁 인정전",
        "name_en": "Changdeokgung Injeongjeon",
        "lat": 37.5794,
        "lng": 126.9910,
        "description_en": "The main throne hall of the palace where the political tension and the zombie outbreak began in the series.",
        "must_do_en": "Walk through the majestic courtyard and feel the royal atmosphere of the Joseon Dynasty.",
    },
    {
        "package_id": 12,
        "name_ko": "비둘기낭 폭포",
        "name_en": "Buidulginang Cascade",
        "lat": 38.1063,
        "lng": 127.1994,
        "description_en": "The mysterious waterfall where the 'Resurrection Plant' (Saengsacho) was discovered in a cold cave.",
        "must_do_en": "Admire the unique columnar joints and the mystical cave where the dark secrets of the series started.",
    },
    {
        "package_id": 12,
        "name_ko": "경희궁 숭정전",
        "name_en": "Gyeonghuigung Sungjeongjeon",
        "lat": 37.5712,
        "lng": 126.9682,
        "description_en": "A major filming location representing the inner palace where Crown Prince Lee Chang fought for his life.",
        "must_do_en": "Explore the relatively quiet palace grounds and imagine the intense zombie chase scenes.",
    },
    {
        "package_id": 12,
        "name_ko": "안동 부용대",
        "name_en": "Andong Buyongdae Cliff",
        "lat": 36.5772,
        "lng": 128.5144,
        "description_en": "The stunning cliff overlooking Hahoe Village, providing a panoramic view of the traditional landscape in the drama.",
        "must_do_en": "Take a ferry across the river and hike up the cliff for a breathtaking view of the Joseon-style village.",
    },
    {
        "package_id": 12,
        "name_ko": "문경새재 오픈세트장",
        "name_en": "Mungyeongsaejae Set",
        "lat": 36.7621,
        "lng": 128.0673,
        "description_en": "A massive historical set that recreated the gates and streets of Hanyang, the capital of Joseon.",
        "must_do_en": "Walk through the fortress gates and feel like you are stepping into a scene from the drama.",
    },
    {
        "package_id": 12,
        "name_ko": "창경궁 통명전",
        "name_en": "Changgyeonggung Tongmyeongjeon",
        "lat": 37.5788,
        "lng": 126.9948,
        "description_en": "The residence of the Queen in the drama, where dark conspiracies and secrets were hidden.",
        "must_do_en": "Sit by the peaceful pond near the hall and reflect on the chilling stories that took place here.",
    },
    {
        "package_id": 13,
        "name_ko": "돼지쌀슈퍼 (우리슈퍼)",
        "name_en": "Doejissal Supermarket",
        "lat": 37.5543,
        "lng": 126.9587,
        "description_en": "The real-life 'Woori Super' where the story begins with Ki-woo receiving a tutoring job offer.",
        "must_do_en": "Take a nostalgic photo in front of the supermarket's iconic blue sign and old-school vibe.",
    },
    {
        "package_id": 13,
        "name_ko": "자하문 터널 계단",
        "name_en": "Jahamun Tunnel Stairs",
        "lat": 37.5925,
        "lng": 126.9664,
        "description_en": "The cinematic stairs the Kim family rushed down in the rain, symbolizing their descent back to reality.",
        "must_do_en": "Capture a silhouette photo inside the tunnel to recreate the movie's moody atmosphere.",
    },
    {
        "package_id": 13,
        "name_ko": "스카이피자",
        "name_en": "Sky Pizza",
        "lat": 37.5134,
        "lng": 126.9463,
        "description_en": "The actual family-run pizza shop that served as the model for 'Pizza Age' in the movie.",
        "must_do_en": "See the original pizza boxes used in the film and try their signature fried chicken or pizza.",
    },
    {
        "package_id": 13,
        "name_ko": "한육감 D타워점",
        "name_en": "Han-yuk-gam (D-Tower)",
        "lat": 37.5710,
        "lng": 126.9796,
        "description_en": "A premium Hanwoo restaurant in Gwanghwamun that serves 'Hanwoo Striploin Jjapaguri' inspired by the film.",
        "must_do_en": "Taste the luxurious 'Ram-don' topped with high-quality Korean beef, just like the Park family.",
    },
    {
        "package_id": 13,
        "name_ko": "광장시장 라면 노점",
        "name_en": "Gwangjang Market Ramen Stalls",
        "lat": 37.5701,
        "lng": 126.9993,
        "description_en": "A bustling traditional market where some street food stalls cook 'Jjapaguri' on the spot for fans.",
        "must_do_en": "Enjoy the lively market energy while eating a freshly made, steaming bowl of Jjapaguri.",
    },
    {
        "package_id": 13,
        "name_ko": "성북동 언덕길",
        "name_en": "Seongbuk-dong Hill Road",
        "lat": 37.5947,
        "lng": 126.9942,
        "description_en": "The wealthy neighborhood that inspired the location of the Parks' mansion, showing the high-walled luxury.",
        "must_do_en": "Walk along the quiet, steep streets to feel the stark contrast between the two worlds in the movie.",
    },
    {
        "package_id": 13,
        "name_ko": "망원동 기사식당 거리",
        "name_en": "Mangwon Driver's Restaurant Street",
        "lat": 37.5559,
        "lng": 126.9012,
        "description_en": "A street full of affordable 'Bulbaek' (Bulgogi sets), representing the authentic soul food of the Kims' class.",
        "must_do_en": "Experience a hearty meal at a local driver's restaurant, a symbol of Seoul's working-class culture.",
    },
    {
        "package_id": 14,
        "name_ko": "카페 몽테드",
        "name_en": "Cafe Montet",
        "lat": 37.2872,
        "lng": 127.0145,
        "description_en": "The iconic house of Sol (Geum-Video) with the famous blue door where the two main characters shared many memories.",
        "must_do_en": "Take a photo in front of the blue door with a yellow umbrella to recreate the drama's poster.",
    },
    {
        "package_id": 14,
        "name_ko": "행궁동 벽화마을",
        "name_en": "Haenggung-dong Mural Village",
        "lat": 37.2878,
        "lng": 127.0162,
        "description_en": "The charming alleyways where Sun-jae and Sol lived across from each other, filled with colorful murals.",
        "must_do_en": "Stroll through the nostalgic alleys and find the hidden murals that capture the youth of the characters.",
    },
    {
        "package_id": 14,
        "name_ko": "방화수류정",
        "name_en": "Banghwasuryujeong",
        "lat": 37.2891,
        "lng": 127.0169,
        "description_en": "A beautiful pavilion near the lotus pond where the couple enjoyed romantic and scenic night views.",
        "must_do_en": "Have a small picnic by the pond and enjoy the peaceful atmosphere of the Suwon Hwaseong Fortress.",
    },
    {
        "package_id": 14,
        "name_ko": "화홍문 성곽길",
        "name_en": "Hwahongmun Gate Path",
        "lat": 37.2887,
        "lng": 127.0164,
        "description_en": "The majestic fortress path where Sun-jae and Sol walked together, showcasing the harmony of history and nature.",
        "must_do_en": "Walk along the fortress wall at sunset to experience the dreamy and romantic mood of the drama.",
    },
    {
        "package_id": 14,
        "name_ko": "행리단길 카페거리",
        "name_en": "Haenglidan-gil Cafe Street",
        "lat": 37.2854,
        "lng": 127.0135,
        "description_en": "A trendy street filled with aesthetic cafes that reflect the modern date spots of the couple in the series.",
        "must_do_en": "Visit a rooftop cafe to see the panoramic view of the fortress while enjoying a sweet dessert.",
    },
    {
        "package_id": 14,
        "name_ko": "화홍문 공영주차장 인근",
        "name_en": "Hwahongmun Area",
        "lat": 37.2895,
        "lng": 127.0180,
        "description_en": "The riverside area where Sun-jae taught Sol how to ride a bike, representing their blossoming feelings.",
        "must_do_en": "Take a light walk or rent a bike along the stream to feel the refreshing energy of a youth romance.",
    },
    {
        "package_id": 14,
        "name_ko": "연무대 국궁체험장",
        "name_en": "Yeonmudae Archery Field",
        "lat": 37.2870,
        "lng": 127.0232,
        "description_en": "A spot representing Sun-jae's athletic side, offering a grand view of the training grounds from the Joseon era.",
        "must_do_en": "Try the traditional Korean archery (Gukgung) experience to feel Sun-jae's focus and passion.",
    },
    {
        "package_id": 15,
        "name_ko": "목포근대역사관 1관",
        "name_en": "Mokpo Modern History Museum",
        "lat": 34.7878,
        "lng": 126.3768,
        "description_en": "The iconic red-brick exterior of 'Hotel Del Luna' that represents its mysterious and antique charm.",
        "must_do_en": "Take a photo in front of the main entrance to feel the ghostly yet elegant aura of the hotel.",
    },
    {
        "package_id": 15,
        "name_ko": "개성만두 궁",
        "name_en": "Gaeseong Mandu Koong",
        "lat": 37.5748,
        "lng": 126.9846,
        "description_en": "A historic restaurant in Insadong famous for authentic Gaeseong-style 'Joraengi Tteokguk' with a traditional vibe.",
        "must_do_en": "Taste the chewy 'Joraengi Tteokguk' in a beautiful Hanok setting, just like the Gaeseong food Man-wol loved.",
    },
    {
        "package_id": 15,
        "name_ko": "창화당 대학로점",
        "name_en": "Changhwadang (Daehak-ro)",
        "lat": 37.5815,
        "lng": 127.0004,
        "description_en": "The actual dumpling spot where Man-wol and Chan-sung had a meal, known for its unique retro interior.",
        "must_do_en": "Try the 'Assorted Pan-fried Dumplings' and imagine Jang Man-wol’s picky but gourmet taste.",
    },
    {
        "package_id": 15,
        "name_ko": "서울책보고",
        "name_en": "Seoul Book Bogo",
        "lat": 37.5204,
        "lng": 127.1065,
        "description_en": "A visually stunning book storage space used as a mystical library where spirits found their lost memories.",
        "must_do_en": "Walk through the breathtaking arch-shaped book tunnels and capture a cinematic moment.",
    },
    {
        "package_id": 15,
        "name_ko": "커피한약방",
        "name_en": "Coffee Hanyukbang",
        "lat": 37.5663,
        "lng": 126.9888,
        "description_en": "A vintage cafe hidden in a narrow alley, perfectly capturing the 1920s mood of the hotel staff.",
        "must_do_en": "Sip a hand-drip coffee while admiring the antique mother-of-pearl decorations and retro vibe.",
    },
    {
        "package_id": 15,
        "name_ko": "익선동 한옥거리",
        "name_en": "Ikseon-dong Hanok Village",
        "lat": 37.5743,
        "lng": 126.9897,
        "description_en": "A trendy alley filled with boutiques and tea houses, matching the 'Gyeongseong' fashion of Jang Man-wol.",
        "must_do_en": "Rent a vintage costume from the early 1900s and stroll through the narrow hanok alleys.",
    },
    {
        "package_id": 15,
        "name_ko": "성흥사 대웅전",
        "name_en": "Seongheungsa Temple",
        "lat": 35.1517,
        "lng": 128.6655,
        "description_en": "The filming site of 'Manwol-dang', the historical predecessor of the hotel during the Joseon Dynasty.",
        "must_do_en": "Walk through the serene temple grounds and imagine the long, secret history of Jang Man-wol.",
    },
    {
        "package_id": 16,
        "name_ko": "파르나스 호텔 제주",
        "name_en": "Parnas Hotel Jeju",
        "lat": 33.2452,
        "lng": 126.4116,
        "description_en": "The primary filming location for the 'King Hotel' in Jeju, where Gu Won and Sa-rang's romance began.",
        "must_do_en": "Take a walk along the stunning cliffside trail and enjoy the luxury ocean view seen in the drama.",
    },
    {
        "package_id": 16,
        "name_ko": "소노캄 제주",
        "name_en": "Sono Calm Jeju",
        "lat": 33.3251,
        "lng": 126.8402,
        "description_en": "Famous for its unique 'Heart-shaped Tree' (Hanbando Tree) where the couple shared romantic moments in Jeju.",
        "must_do_en": "Find the 'Heart Tree' and take a romantic couple photo just like Gu Won and Sa-rang.",
    },
    {
        "package_id": 16,
        "name_ko": "롯데월드 어드벤처",
        "name_en": "Lotte World Adventure",
        "lat": 37.5111,
        "lng": 127.0982,
        "description_en": "The iconic amusement park where Gu Won and Sa-rang had a magical and dreamy date wearing school uniforms.",
        "must_do_en": "Rent a school uniform and ride the 'Merry-Go-Round' to recreate the whimsical date scene.",
    },
    {
        "package_id": 16,
        "name_ko": "그랜드 하얏트 서울",
        "name_en": "Grand Hyatt Seoul",
        "lat": 37.5391,
        "lng": 126.9975,
        "description_en": "Used as the sophisticated interior and grand lobby of the 'King Hotel' in the Seoul-based scenes.",
        "must_do_en": "Have a coffee at the lobby lounge and enjoy the panoramic view of Seoul's Namsan mountain.",
    },
    {
        "package_id": 17,
        "name_ko": "선샤인 스튜디오",
        "name_en": "Sunshine Studio (Nonsan)",
        "lat": 36.1015,
        "lng": 127.1425,
        "description_en": "The main filming set that recreates early 1900s Hanseong, featuring the Glory Hotel and the historic streetcar.",
        "must_do_en": "Rent a period costume and walk through the streets of Hanseong, taking a signature photo at the Glory Hotel.",
    },
    {
        "package_id": 17,
        "name_ko": "안동 만휴정",
        "name_en": "Manhujeong Pavilion",
        "lat": 36.4385,
        "lng": 128.8752,
        "description_en": "The famous stone bridge where Eugene and Ae-shin shared their first mutual confession: \"Let's do 'Love' with me.\"",
        "must_do_en": "Walk across the small bridge over the stream and recreate the iconic 'Love' proposal scene from the drama.",
    },
    {
        "package_id": 17,
        "name_ko": "경주 삼릉숲",
        "name_en": "Samneung Pine Forest",
        "lat": 35.8034,
        "lng": 129.2081,
        "description_en": "The mystical and foggy pine forest where Eugene and Ae-shin had their secret and intense encounters.",
        "must_do_en": "Walk through the towering, twisted pine trees in the early morning to feel the solemn and mysterious vibe.",
    },
    {
        "package_id": 17,
        "name_ko": "예천 초간정",
        "name_en": "Choganjeong Pavilion",
        "lat": 36.7112,
        "lng": 128.4312,
        "description_en": "The beautiful pavilion by the crystal-clear stream where Ae-shin practiced her shooting and learned English.",
        "must_do_en": "Enjoy the tranquil valley scenery and reflect on the strong will of the noble lady-turned-soldier.",
    },
    {
        "package_id": 17,
        "name_ko": "청주 운보의 집",
        "name_en": "Unbo's House",
        "lat": 36.7145,
        "lng": 127.4982,
        "description_en": "A grand traditional Korean house (Hanok) used as the filming site for the residence of the noble Go family.",
        "must_do_en": "Explore the spacious Hanok garden and experience the dignity and elegance of the Joseon aristocracy.",
    },
    {
        "package_id": 18,
        "name_ko": "태백 한보광장 (태후공원)",
        "name_en": "Taebaek Hanbo Square",
        "lat": 37.1325,
        "lng": 129.0142,
        "description_en": "The main filming site for the 'Urk' military base, where the iconic shoe-tying scene took place.",
        "must_do_en": "Take a photo at the reconstructed Medicube and see the military vehicles used in the drama.",
    },
    {
        "package_id": 18,
        "name_ko": "서래갈매기 회기점",
        "name_en": "Seorae Galmaegi (Hoegi)",
        "lat": 37.5912,
        "lng": 127.0515,
        "description_en": "The actual BBQ restaurant where Yoo Si-jin and Seo Dae-young had their legendary '3-day drinking' session.",
        "must_do_en": "Order the signature 'Galmaegisal' (Pork Skirt Meat) and enjoy it with Soju, just like the soldiers.",
    },
    {
        "package_id": 18,
        "name_ko": "파주 캠프그리브스",
        "name_en": "Camp Greaves (Paju)",
        "lat": 37.8912,
        "lng": 126.7415,
        "description_en": "A former US military base that served as the Urk barracks; it holds the raw, military tension of the show.",
        "must_do_en": "Walk through the Quonset huts and military tunnels, and experience a DMZ-themed tour.",
    },
    {
        "package_id": 18,
        "name_ko": "정선 삼탄아트마인",
        "name_en": "Samtan Art Mine",
        "lat": 37.2185,
        "lng": 128.7124,
        "description_en": "An abandoned mine turned art complex, used as the site for the earthquake rescue and the villain's hideout.",
        "must_do_en": "Explore the 'Emergency Room' set and the rugged industrial atmosphere that doubled as Urk's ruins.",
    },
    {
        "package_id": 18,
        "name_ko": "월미도 사격장",
        "name_en": "Wolmido Shooting Range",
        "lat": 37.4764,
        "lng": 126.5915,
        "description_en": "The place from the first episode where Si-jin and Dae-young showed off their shooting skills with toy guns.",
        "must_do_en": "Try the BB gun shooting game at the theme park and see if you can match Captain Yoo's aim.",
    },
    {
        "package_id": 18,
        "name_ko": "인천 신포문화의거리",
        "name_en": "Sinpo Cultural Street",
        "lat": 37.4715,
        "lng": 126.6289,
        "description_en": "The street where the first episode's chase scene and the 'thief-catching' moment with a toy gun were filmed.",
        "must_do_en": "Enjoy local street foods like 'Sinpo Dakgangjeong' while walking through this historic shopping street.",
    },
    {
        "package_id": 19,
        "name_ko": "더현대 서울",
        "name_en": "The Hyundai Seoul",
        "lat": 37.5259,
        "lng": 126.9284,
        "description_en": "The actual filming location for 'Queens Department Store,' representing the luxurious lifestyle of CEO Hong Hae-in.",
        "must_do_en": "Visit the 'Sounds Forest' on the 5th floor to feel the grand and green atmosphere of the Queens Group.",
    },
    {
        "package_id": 19,
        "name_ko": "문경 용두리 세트장",
        "name_en": "Mungyeong Yongdu-ri Set",
        "lat": 36.7621,
        "lng": 128.0673,
        "description_en": "The nostalgic village setting for Baek Hyun-woo's hometown, where the warm-hearted family scenes took place.",
        "must_do_en": "Stroll through the quiet village and find the spots where the 'Yongdu-ri' family shared their stories.",
    },
    {
        "package_id": 19,
        "name_ko": "아쿠아플라넷 일산",
        "name_en": "Aqua Planet Ilsan",
        "lat": 37.6651,
        "lng": 126.7538,
        "description_en": "The aquarium where Hyun-woo and Hae-in shared a dreamy and romantic moment surrounded by marine life.",
        "must_do_en": "Walk through the underwater tunnel and capture the mysterious and emotional vibe of the couple's date.",
    },
    {
        "package_id": 19,
        "name_ko": "워커힐 호텔 애스톤하우스",
        "name_en": "Walkerhill Aston House",
        "lat": 37.5552,
        "lng": 127.1109,
        "description_en": "The stunning mansion used as the exterior for the Queens family residence and their spectacular wedding scene.",
        "must_do_en": "Enjoy the panoramic view of the Han River and admire the elegant architecture of the luxury estate.",
    },
    {
        "package_id": 20,
        "name_ko": "영월 청령포",
        "name_en": "Yeongwol Cheongnyeongpo",
        "lat": 37.1725,
        "lng": 128.4521,
        "description_en": "The main filming location and actual exile site of King Danjong, a 'landlocked island' where he was isolated.",
        "must_do_en": "Take a boat to the pine forest and find the 'Gwaneumsong' tree, the silent witness to the King's sorrow.",
    },
    {
        "package_id": 20,
        "name_ko": "문경새재 오픈세트장",
        "name_en": "Mungyeongsaejae Open Set",
        "lat": 36.7845,
        "lng": 128.0612,
        "description_en": "The primary filming site for 'Gwangcheongol' village, where the characters lived while protecting the King.",
        "must_do_en": "Explore the thatched-roof houses and rugged mountain paths that recreate the early Joseon atmosphere.",
    },
    {
        "package_id": 20,
        "name_ko": "영월 관풍헌 & 자규루",
        "name_en": "Gwanpungheon & Jagyuru",
        "lat": 37.1852,
        "lng": 128.4674,
        "description_en": "The historic guest house where the King spent his final days writing mournful poems after leaving Cheongnyeongpo.",
        "must_do_en": "Stand at Jagyuru Pavilion where the King compared his lonely fate to a bird, a key emotional point in the film.",
    },
    {
        "package_id": 20,
        "name_ko": "서울 동망봉 (숭인공원)",
        "name_en": "Dongmangbong Peak",
        "lat": 37.5755,
        "lng": 127.0185,
        "description_en": "The hill where Queen Jeongsun climbed every day to look toward Yeongwol, praying for her exiled husband's safety.",
        "must_do_en": "Look out over the city toward the east and feel the lifelong longing of the Queen after their forced separation.",
    },
    {
        "package_id": 20,
        "name_ko": "영주 금성대군 신단",
        "name_en": "Geumseongdaegun Shindan",
        "lat": 36.9114,
        "lng": 128.5812,
        "description_en": "The sacred site honoring Prince Geumseong, who was exiled to Sunheung and died attempting to restore King Danjong.",
        "must_do_en": "Visit the altar where the loyal spirits are enshrined and feel the heavy atmosphere of Joseon's tragic history.",
    },
    {
        "package_id": 20,
        "name_ko": "영주 피끝마을 (동촌1리)",
        "name_en": "Pikeut Village",
        "lat": 36.8785,
        "lng": 128.5724,
        "description_en": "A village meaning 'where blood stopped flowing' after the massacre of those who supported the King's restoration.",
        "must_do_en": "Walk along the Jugyecheon stream and reflect on the sacrifices made by the local people for their loyalty.",
    },
    {
        "package_id": 20,
        "name_ko": "영주 소수서원 & 취한대",
        "name_en": "Sosu Seowon & Chwihandae",
        "lat": 36.9252,
        "lng": 128.5785,
        "description_en": "The former site of Suksusa Temple, where the restoration was planned, now home to Korea's first Confucian academy.",
        "must_do_en": "Stand at Chwihandae pavilion and imagine the secret meetings of the loyalists hidden in the scenic valley.",
    },
    {
        "package_id": 20,
        "name_ko": "영월 장릉보리밥집",
        "name_en": "Jangleung Boribap",
        "lat": 37.1882,
        "lng": 128.4554,
        "description_en": "A local spot near the King's tomb serving humble barley rice with potatoes and seasonal wild herbs.",
        "must_do_en": "Try the 'Nunsan-namul' and barley rice, reflecting the simple yet heartfelt meals shared during that era.",
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    package_id_map: dict[int, int] = {}

    for row in EXTRA_PACKAGES:
        # id 고정 삽입 대신 (category, title_en) 기준으로 upsert
        bind.execute(
            sa.text(
                """
                INSERT INTO k_content_packages
                (category, title_ko, title_en, description_en, image_url, tags)
                SELECT :category, :title_ko, :title_en, :description_en, :image_url, :tags
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM k_content_packages
                    WHERE category = :category AND title_en = :title_en
                )
                """
            ),
            row,
        )

        pkg_id = bind.execute(
            sa.text(
                """
                SELECT id
                FROM k_content_packages
                WHERE category = :category AND title_en = :title_en
                ORDER BY id
                LIMIT 1
                """
            ),
            row,
        ).scalar_one()
        package_id_map[row["id"]] = int(pkg_id)

    for row in EXTRA_PLACES:
        resolved_package_id = package_id_map[row["package_id"]]
        bind.execute(
            sa.text(
                """
                INSERT INTO k_content_places
                (package_id, name_ko, name_en, lat, lng, description_en, must_do_en)
                SELECT :package_id, :name_ko, :name_en, :lat, :lng, :description_en, :must_do_en
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM k_content_places
                    WHERE package_id = :package_id
                      AND name_en = :name_en
                      AND lat = :lat
                      AND lng = :lng
                )
                """
            ),
            {
                "package_id": resolved_package_id,
                "name_ko": row["name_ko"],
                "name_en": row["name_en"],
                "lat": row["lat"],
                "lng": row["lng"],
                "description_en": row["description_en"],
                "must_do_en": row["must_do_en"],
            },
        )


def downgrade() -> None:
    bind = op.get_bind()

    # title 기준으로 패키지 id를 찾고 해당 place 정리
    package_ids = [
        int(pid)
        for pid in bind.execute(
            sa.text(
                """
                SELECT id
                FROM k_content_packages
                WHERE (category, title_en) IN (
                    ('KDRAMA', 'Goblin'),
                    ('KDRAMA', 'Squid Game'),
                    ('KDRAMA', 'Crash Landing on You'),
                    ('KDRAMA', 'Kingdom'),
                    ('KMOVIE', 'Parasite'),
                    ('KDRAMA', 'Lovely Runner'),
                    ('KDRAMA', 'Hotel Del Luna'),
                    ('KDRAMA', 'King the Land'),
                    ('KDRAMA', 'Mr. Sunshine'),
                    ('KDRAMA', 'Descendants of the Sun'),
                    ('KDRAMA', 'Queen of Tears'),
                    ('KMOVIE', 'The Man Who Lives with the King')
                )
                """
            )
        ).scalars()
    ]
    if package_ids:
        ids_param = sa.bindparam("ids", expanding=True)
        bind.execute(
            sa.text("DELETE FROM k_content_places WHERE package_id IN :ids").bindparams(ids_param),
            {"ids": package_ids},
        )

    # 이 migration이 관리하는 추가 패키지 삭제
    bind.execute(
        sa.text(
            """
            DELETE FROM k_content_packages
            WHERE (category, title_en) IN (
                ('KDRAMA', 'Goblin'),
                ('KDRAMA', 'Squid Game'),
                ('KDRAMA', 'Crash Landing on You'),
                ('KDRAMA', 'Kingdom'),
                ('KMOVIE', 'Parasite'),
                ('KDRAMA', 'Lovely Runner'),
                ('KDRAMA', 'Hotel Del Luna'),
                ('KDRAMA', 'King the Land'),
                ('KDRAMA', 'Mr. Sunshine'),
                ('KDRAMA', 'Descendants of the Sun'),
                ('KDRAMA', 'Queen of Tears'),
                ('KMOVIE', 'The Man Who Lives with the King')
            )
            """
        ),
    )
