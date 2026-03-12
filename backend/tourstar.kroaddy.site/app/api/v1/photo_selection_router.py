"""Photo selection router - v1."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import hashlib
from difflib import SequenceMatcher
from base64 import b64encode
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from PIL import ExifTags, Image

from ...domain.v1.contracts import (
    AutoCommentRequest,
    AutoCommentResponse,
    EvaluationRequest,
    GeneratePostRequest,
    GeneratePostResponse,
    JobStatusResponse,
    UploadPhotosResponse,
    UploadPipelineJob,
    UploadedPhoto,
)
from ...domain.v1.graph import build_metadata_graph
from ...domain.v1.state import store, worker


router = APIRouter(prefix="/photo-selection", tags=["photo-selection"])
service_root = Path(__file__).resolve().parents[3]
uploads_dir = service_root / "artifacts" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
_GPS_INFO_TAG = 34853
logger = logging.getLogger(__name__)

_MBTI_TYPES = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}
_STYLE_TEMPLATE_FILE = service_root / "app" / "config" / "mbti_style_templates.json"
_DEFAULT_STYLE_GUIDES: dict[str, str] = {
    "AUTO": (
        "대중적인 인스타 여행 피드 톤. "
        "읽기 쉬운 2~4문장, 과하지 않은 감성, 해시태그 3~5개를 사용한다."
    ),
}
_MBTI_INSTAGRAM_GUIDES: dict[str, dict[str, Any]] = {
    "INTJ": {
        "concept": "지적 통찰과 효율 중심",
        "lifestyle": "생산성, 딥워크, 미니멀 루틴",
        "structure": "[문제 제기] -> [논리적 해결/결론] -> [짧고 굵은 한마디]",
        "tone": "냉철하고 단호한 평어",
        "emoji": "0~1개",
        "headline_examples": ["감정보다 시스템이 답이다", "5년 뒤를 위한 오늘의 배치"],
        "hashtags": ["생산성", "딥워크", "미니멀리즘", "자기계발", "집중기록"],
    },
    "INTP": {
        "concept": "호기심 기반 고찰과 아이디어 실험",
        "lifestyle": "지적 탐구, 밤샘, 생각 정리",
        "structure": "[엉뚱한 질문] -> [나만의 가설] -> [흥미롭네/귀찮아짐]",
        "tone": "혼잣말형, '~인 듯' '~인가?'",
        "emoji": "0~1개",
        "headline_examples": ["이게 왜 안 될까? (고민 중)", "문득 든 생각인데..."],
        "hashtags": ["생각이많은밤", "고찰", "지적호기심", "밤샘", "인사이트"],
    },
    "ENTJ": {
        "concept": "목표 달성과 성장 중심",
        "lifestyle": "커리어 집중, 성과 관리, 루틴 실행",
        "structure": "[오늘의 성취] -> [성공 루틴] -> [팔로워 질문]",
        "tone": "확신에 찬 리더형 어조",
        "emoji": "0~1개",
        "headline_examples": ["변명은 성장을 막을 뿐", "오늘의 성취 리스트"],
        "hashtags": ["성공", "동기부여", "커리어", "압도적성장", "갓생"],
    },
    "ENTP": {
        "concept": "위트와 반전, 도발적 토론",
        "lifestyle": "아이디어 확장, 실험적 시도, 토론",
        "structure": "[상식 뒤집기] -> [유머러스한 궤변] -> [열린 결론]",
        "tone": "능글맞고 재치 있는 말투",
        "emoji": "1~2개",
        "headline_examples": ["이 의견에 반대하는 사람?", "오늘도 논리적으로 털어봄"],
        "hashtags": ["아이디어", "위트", "토론", "세상은넓고", "재밌으면장땡"],
    },
    "INFJ": {
        "concept": "깊은 내면과 은유적 성찰",
        "lifestyle": "기록, 마음챙김, 조용한 회복",
        "structure": "[풍경 묘사] -> [내면 성찰] -> [세상을 향한 시선]",
        "tone": "차분하고 문학적인 어조",
        "emoji": "0~1개",
        "headline_examples": ["우리는 모두 연결되어 있다", "심연을 들여다보는 시간"],
        "hashtags": ["새벽감성", "단상", "기록", "마음챙김", "오후의조각"],
    },
    "INFP": {
        "concept": "몽글한 감성과 자기 고백",
        "lifestyle": "빈티지 무드, 나만의 시간, 상상",
        "structure": "[기분 이모지] -> [일기형 고백] -> [작은 행복]",
        "tone": "부드럽고 여운 있는 말투, 말줄임표 허용",
        "emoji": "1~2개",
        "headline_examples": ["나만의 작은 우주", "오늘은 구름이 참 예쁘다"],
        "hashtags": ["무드", "빈티지감성", "나만의시간", "소중해", "꿈꾸는일상"],
    },
    "ENFJ": {
        "concept": "긍정 에너지와 따뜻한 연대",
        "lifestyle": "응원, 성장, 관계 중심",
        "structure": "[다정한 인사] -> [나누고 싶은 가치] -> [응원 멘트]",
        "tone": "따뜻하고 활기찬 리더형 말투",
        "emoji": "1~2개",
        "headline_examples": ["여러분은 충분히 잘하고 있어요", "함께라서 행복한 오늘"],
        "hashtags": ["응원", "긍정의힘", "함께성장", "다정함", "오늘의일기"],
    },
    "ENFP": {
        "concept": "텐션 높은 일상과 활발한 소통",
        "lifestyle": "새로운 만남, 이벤트, 즉흥성",
        "structure": "[감탄사] -> [신나는 사건] -> [소통 유도]",
        "tone": "발랄하고 리듬감 있는 반말",
        "emoji": "2~3개",
        "headline_examples": ["대박! 이거 보러 올 사람?", "인생은 파티야!"],
        "hashtags": ["핵인싸", "신난다", "에너지뿜뿜", "일상소통", "데일리기록"],
    },
    "ISTJ": {
        "concept": "성실한 기록과 안정감",
        "lifestyle": "루틴, 정리정돈, 자기관리",
        "structure": "[날짜/시간/장소] -> [팩트 기록] -> [깔끔한 마무리]",
        "tone": "정돈된 문장, 정확한 정보 중심",
        "emoji": "0개",
        "headline_examples": ["루틴이 만드는 결과", "오늘의 할 일 완료"],
        "hashtags": ["루틴", "공부인증", "자기관리", "정리정돈", "깔끔기록"],
    },
    "ISFJ": {
        "concept": "배려와 감사가 담긴 일상",
        "lifestyle": "소확행, 집밥, 추억 보관",
        "structure": "[사람 언급] -> [고마움] -> [따뜻한 인사]",
        "tone": "친절하고 겸손한 어조",
        "emoji": "1개",
        "headline_examples": ["소중한 사람을 위한 정성", "마음이 따뜻해지는 순간"],
        "hashtags": ["소확행", "감사", "따뜻한일상", "추억", "집밥"],
    },
    "ESTJ": {
        "concept": "성과 중심 실행과 시간 관리",
        "lifestyle": "오운완, 결과 인증, 목표 달성",
        "structure": "[완료한 할 일] -> [효율 팁] -> [자극 멘트]",
        "tone": "짧고 명확한 지시형 어투",
        "emoji": "0~1개",
        "headline_examples": ["계획 없는 삶은 실패다", "주간 성과 보고"],
        "hashtags": ["오운완", "프로갓생러", "성실", "목표달성", "열정기록"],
    },
    "ESFJ": {
        "concept": "관계 중심의 친화력과 정보 공유",
        "lifestyle": "모임, 카페투어, 주말 나들이",
        "structure": "[함께한 장면] -> [모임 후기] -> [애정 표현]",
        "tone": "친화적이고 싹싹한 말투",
        "emoji": "1~2개",
        "headline_examples": ["여기 분위기 대박!", "오늘 모임 너무 즐거웠어"],
        "hashtags": ["맛스타그램", "모임", "카페투어", "주말나들이", "함께"],
    },
    "ISTP": {
        "concept": "마이웨이와 몰입형 취미",
        "lifestyle": "커스텀, 작업, 몰입",
        "structure": "[작업/취미 장면] -> [짧은 설명] -> [담백한 끝맺음]",
        "tone": "시크하고 간결한 평어",
        "emoji": "0개",
        "headline_examples": ["그냥 하는 거지", "취미 생활 중"],
        "hashtags": ["마이웨이", "취미", "커스텀", "시크", "몰입"],
    },
    "ISFP": {
        "concept": "오감 중심의 감각적 힐링",
        "lifestyle": "감성, 여유, 플레이리스트",
        "structure": "[감각적 장면] -> [오감 묘사] -> [느긋한 마무리]",
        "tone": "나긋하고 여유로운 감성",
        "emoji": "1~2개",
        "headline_examples": ["지금 이 분위기", "느긋한 오후가 좋아"],
        "hashtags": ["감성", "힐링", "편안함", "여유", "플레이리스트"],
    },
    "ESTP": {
        "concept": "현재의 즐거움과 스릴",
        "lifestyle": "액티비티, 욜로 감성, 즉시 실행",
        "structure": "[역동적 장면] -> [자신감 멘트] -> [행동 유도]",
        "tone": "짧고 강렬한 에너제틱 반말",
        "emoji": "1개",
        "headline_examples": ["고민은 배송만 늦출 뿐", "인생 한 번이지!"],
        "hashtags": ["욜로", "액티비티", "플렉스", "인생은즐거워", "즉흥여행"],
    },
    "ESFP": {
        "concept": "화려한 텐션과 핫플 감성",
        "lifestyle": "오늘의룩, 데일리룩, 셀피",
        "structure": "[오늘의 룩] -> [핫플 반응] -> [함께 놀자]",
        "tone": "텐션 높고 유행어 친화적",
        "emoji": "2~3개",
        "headline_examples": ["오늘 주인공은 나!", "세상에서 제일 신남"],
        "hashtags": ["오늘의룩", "패션스타그램", "데일리룩", "핫플", "셀스타그램"],
    },
}


def _render_mbti_style_guide(style_filter: str) -> str:
    normalized = _normalize_style_filter(style_filter)
    guide = _MBTI_INSTAGRAM_GUIDES.get(normalized)
    if not guide:
        return _DEFAULT_STYLE_GUIDES["AUTO"]
    tags = ", ".join(guide.get("hashtags") or [])
    headlines = " / ".join(guide.get("headline_examples") or [])
    return (
        f"컨셉: {guide['concept']}. "
        f"라이프스타일: {guide['lifestyle']}. "
        f"헤드라인 예시: {headlines}. "
        f"글 구조: {guide['structure']}. "
        f"말투: {guide['tone']}. "
        f"이모지: {guide['emoji']}. "
        f"권장 해시태그: {tags}."
    )


def _mbti_prompt_constraints(style_filter: str) -> str:
    # MBTI 템플릿 가이드를 최우선으로 사용한다.
    guide = _MBTI_INSTAGRAM_GUIDES.get(style_filter)
    if guide:
        hashtags = ", ".join(guide.get("hashtags") or [])
        return (
            f"- 컨셉: {guide['concept']}\n"
            f"- 구조: {guide['structure']}\n"
            f"- 말투: {guide['tone']}\n"
            f"- 이모지 사용량: {guide['emoji']}\n"
            f"- 권장 해시태그: {hashtags}\n"
            "- 규칙: 위 형식은 참고만 하고, 예시 문구/해시태그를 그대로 복붙하지 말 것\n"
            "- 길이: 본문 100~300자 내외(해시태그 라인 별도)\n"
            "- 금지: MBTI 명칭 직접 언급, 설명문 위주의 블로그체, 평이한 문장"
        )

    # AUTO는 기본 인스타 스타일을 유지한다.
    if style_filter == "AUTO":
        return (
            "- 문장 길이: 100~300자 내외 + 해시태그 1줄\n"
            "- 이모지: 1개\n"
            "- 말투: 가벼운 반말 감성\n"
            "- 금지: 설명문/리뷰체/일기체 장문"
        )

    e_or_i = style_filter[0]
    s_or_n = style_filter[1]
    t_or_f = style_filter[2]
    j_or_p = style_filter[3]

    emoji_count = "0~1개" if t_or_f == "T" else "1~2개"
    sentence_len = "짧고 단호하게" if j_or_p == "J" else "리듬감 있게"
    tone = "팩트/핵심 중심" if t_or_f == "T" else "감정/무드 중심"
    intro = "바로 핵심부터" if e_or_i == "E" else "한 박자 여유 있게 시작"
    detail = "장면/디테일 위주" if s_or_n == "S" else "의미/인상 위주"

    return (
        f"- 문장 길이: {sentence_len} 2문장 + 해시태그 1줄\n"
        f"- 이모지: {emoji_count}\n"
        f"- 첫 문장 시작: {intro}\n"
        f"- 본문 포커스: {tone}, {detail}\n"
        "- 금지: '~했어요/했습니다' 중심의 블로그 문체, 과도한 배경설명, 중복 수식"
    )


def _tone_bucket(style_filter: str) -> str:
    if style_filter in {"ISFP", "INFP", "INFJ"}:
        return "emotional"
    if style_filter in {"ESTJ", "ISTJ", "ENTJ"}:
        return "info"
    if style_filter in {"ENTP", "ESTP", "ESFP", "ENFP"}:
        return "trendy"
    return "default"


def _few_shot_example(style_filter: str) -> str:  # noqa: PLR0911
    """MBTI별 인스타 피드 few-shot 예시 (body 형식)."""
    normalized = _normalize_style_filter(style_filter)

    _examples: dict[str, str] = {
        # ── NT 계열 ──────────────────────────────────────────────────────────
        "INTJ": (
            '출력(JSON): {"title":"파란 하늘 아래 셋업 완료 ✔","location":"부산 해운대",'
            '"body":"감정 낭비 없이 루트 확정. 해운대-광안리-씨앗호떡, 비용·동선 최적화 끝. '
            '여행도 결국 시스템이다.",'
            '"tags":["미니멀여행","딥워크","생산성","자기계발","기록"]}'
        ),
        "INTP": (
            '출력(JSON): {"title":"밤바다 앞에서 드는 생각...","location":"부산",'
            '"body":"파도가 왜 저 리듬으로 치는지 문득 궁금해짐. '
            '해운대 밤바다 보면서 혼자 가설 세 개 세움. 결론은 아직 없음. 흥미롭네.",'
            '"tags":["고찰","생각이많은밤","지적호기심","밤샘","인사이트"]}'
        ),
        "ENTJ": (
            '출력(JSON): {"title":"부산 2박3일, 완벽 실행","location":"부산",'
            '"body":"계획대로 씨앗호떡·밤바다·해운대 전부 완료. '
            '감성은 목표 달성 후에 챙기는 거다. 이번 여행 KPI 100% 달성.",'
            '"tags":["갓생","압도적성장","커리어","동기부여","성공"]}'
        ),
        "ENTP": (
            '출력(JSON): {"title":"부산 여행 다들 왜 좋아하지? 🤔","location":"부산 해운대",'
            '"body":"밤바다 보면서 진짜 물어보고 싶었음. '
            '해운대가 핫한 이유 분석했는데 결론: 그냥 다 맞음 ㅋ. 반박 시 당신이 맞음.",'
            '"tags":["아이디어","위트","토론","세상은넓고","재밌으면장땡"]}'
        ),
        # ── NF 계열 ──────────────────────────────────────────────────────────
        "INFJ": (
            '출력(JSON): {"title":"밤바다가 건네는 말 ✨","location":"부산 해운대",'
            '"body":"파도 소리가 지쳐있던 마음을 조용히 눌러줬다. '
            '바다 앞에 서면 누구든 잠깐은 솔직해질 것 같아서, 오래 서 있었다.",'
            '"tags":["새벽감성","단상","마음챙김","기록","오후의조각"]}'
        ),
        "INFP": (
            '출력(JSON): {"title":"파도가 오늘 유독 예뻤다 🌊","location":"부산",'
            '"body":"해운대 밤바다 보면서 혼자 씨앗호떡 먹음. '
            '씁쓸하고 달달한 게 오늘 기분이랑 비슷해서 조금 울컥했음... 소중한 기억.",'
            '"tags":["무드","빈티지감성","나만의시간","소중해","꿈꾸는일상"]}'
        ),
        "ENFJ": (
            '출력(JSON): {"title":"함께여서 더 빛났던 부산 🌟","location":"부산 해운대",'
            '"body":"밤바다 보면서 옆에 있는 사람들이 더 소중하다는 걸 새삼 느꼈어요. '
            '이 장면을 함께 기억해줄 수 있어서 고마워요. 여러분도 오늘 잘하고 있어요 💛",'
            '"tags":["응원","긍정의힘","다정함","함께성장","오늘의일기"]}'
        ),
        "ENFP": (
            '출력(JSON): {"title":"부산 밤바다 진짜 미쳤음!!! 🔥","location":"부산",'
            '"body":"씨앗호떡 먹고 해운대 달리고 밤바다 노을까지 🌅🌊 '
            '이 에너지 어디서 나오는 거야?? 같이 올 사람 댓글로 소환해요!",'
            '"tags":["핵인싸","신난다","에너지뿜뿜","일상소통","데일리기록"]}'
        ),
        # ── SJ 계열 ──────────────────────────────────────────────────────────
        "ISTJ": (
            '출력(JSON): {"title":"부산 2박3일 동선 정리","location":"부산",'
            '"body":"1일차: 씨앗호떡 → 해운대. 2일차: 광안리 → 국제시장. '
            '총 이동거리 약 18km. 숙소: 해운대 도보 5분. 계획대로 진행됨.",'
            '"tags":["루틴","공부인증","자기관리","정리정돈","깔끔기록"]}'
        ),
        "ISFJ": (
            '출력(JSON): {"title":"같이 걸어줘서 고마워 🧡","location":"부산 해운대",'
            '"body":"씨앗호떡 한 입씩 나눠 먹으며 걸었던 해운대. '
            '밤바다 보면서 이 사람들이랑 오래 함께하고 싶다고 생각했어. 감사한 하루.",'
            '"tags":["소확행","감사","따뜻한일상","추억","집밥"]}'
        ),
        "ESTJ": (
            '출력(JSON): {"title":"부산 여행 체크리스트 완료 ✅","location":"부산",'
            '"body":"씨앗호떡 ✓ 해운대 ✓ 밤바다 ✓. 2박3일 일정 오차 30분 이내로 완주. '
            '비효율 없이 핵심만 뽑아낸 여행. 다음 계획 짜는 중.",'
            '"tags":["오운완","프로갓생러","성실","목표달성","열정기록"]}'
        ),
        "ESFJ": (
            '출력(JSON): {"title":"부산 여기 무조건 와야 해!! 🤩","location":"부산 해운대",'
            '"body":"씨앗호떡 줄 길어도 기다릴 가치 있음! 해운대 밤바다 배경으로 인생샷 각. '
            '같이 온 친구들이 너무 좋아해서 뿌듯했어 🥰 다음엔 더 많이 데려올 거야!",'
            '"tags":["모임","카페투어","주말나들이","함께","여행추천"]}'
        ),
        # ── SP 계열 ──────────────────────────────────────────────────────────
        "ISTP": (
            '출력(JSON): {"title":"부산. 그냥 좋음.","location":"부산 해운대",'
            '"body":"밤바다 바람 맞고 씨앗호떡 먹음. 별 말 없이 걸었음. 충분함.",'
            '"tags":["마이웨이","취미","시크","몰입","기록"]}'
        ),
        "ISFP": (
            '출력(JSON): {"title":"이 색감, 지금 이 느낌 🌅","location":"부산",'
            '"body":"노을이 바다에 번지는 색이 오렌지인지 복숭아인지 한참 봤음. '
            '귓가엔 파도 소리, 손엔 씨앗호떡. 이 순간만큼은 완벽했다.",'
            '"tags":["감성","힐링","여유","편안함","플레이리스트"]}'
        ),
        "ESTP": (
            '출력(JSON): {"title":"고민 없이 부산 직행 🚗","location":"부산 해운대",'
            '"body":"어제 충동적으로 예약하고 오늘 바로 해운대 입장. '
            '씨앗호떡 먹고 밤바다 맞고 인생 무조건 이렇게 사는 거임. 다음 행선지는 모름.",'
            '"tags":["욜로","액티비티","플렉스","인생은즐거워","즉흥여행"]}'
        ),
        "ESFP": (
            '출력(JSON): {"title":"오늘 주인공은 나!!! 🌟✨","location":"부산 해운대",'
            '"body":"씨앗호떡 들고 해운대 노을 구경 🌅 이 분위기에 내가 제일 잘 어울리는 거 알지? '
            '오늘 OOTD도 완벽하고 밤바다 배경도 완벽 🔥 좋아요 눌러줘요오~!",'
            '"tags":["오늘의룩","패션스타그램","데일리룩","핫플","셀스타그램"]}'
        ),
    }

    if normalized in _examples:
        return _examples[normalized]

    # AUTO / 미매핑 fallback
    return (
        '출력(JSON): {"title":"해운대 노을, 저장 📸","location":"부산 해운대",'
        '"body":"씨앗호떡 한 입에 밤바다 노을 한 눈. 걷고 보니 하루가 순삭됨. 오늘도 좋은 하루.",'
        '"tags":["여행기록","감성스냅","오늘의무드","부산여행","여행중"]}'
    )


def _style_profile(style_filter: str) -> dict[str, Any]:
    normalized = _normalize_style_filter(style_filter)
    bucket = _tone_bucket(normalized)
    profile: dict[str, Any] = {
        "bucket": bucket,
        "main_limit": 42,
        "detail_limit": 180,
        "force_casual": True,
        "line_suffix": "",
    }
    if bucket == "emotional":
        profile.update({"main_limit": 46, "detail_limit": 200, "force_casual": False, "line_suffix": " ✨"})
    elif bucket == "info":
        profile.update({"main_limit": 40, "detail_limit": 170, "force_casual": False, "line_suffix": ""})
    elif bucket == "trendy":
        profile.update({"main_limit": 38, "detail_limit": 160, "force_casual": True, "line_suffix": " 🔥"})

    if normalized != "AUTO":
        # T유형은 과한 감성 요소를 줄이고, J유형은 문장을 더 압축한다.
        if normalized[2] == "T":
            profile["line_suffix"] = ""
        if normalized[3] == "J":
            profile["detail_limit"] = max(130, int(profile["detail_limit"]) - 20)
    return profile


def _default_tags_for_style(style_filter: str, seed_text: str) -> list[str]:
    normalized = _normalize_style_filter(style_filter)
    mbti_tags = list((_MBTI_INSTAGRAM_GUIDES.get(normalized) or {}).get("hashtags") or [])
    bucket = _tone_bucket(normalized)
    tag_pool = {
        "emotional": ["감성여행", "무드기록", "여행한컷", "오늘의감정", "필름감성", "여행스냅", "잔잔한순간"],
        "info": ["여행요약", "핵심코스", "주말여행", "동선추천", "여행플랜", "실전코스", "여행메모"],
        "trendy": ["핫플기록", "여행중", "오늘핫플", "주말핫플", "인생샷", "지금여기", "무드스냅"],
        "default": ["여행기록", "감성스냅", "오늘의무드", "추억한컷", "사진일기", "여행일상", "여행스타그램"],
    }
    pool = mbti_tags + list(tag_pool.get(bucket, tag_pool["default"]))
    if not pool:
        return ["여행기록", "감성스냅", "오늘의무드"]

    digest = hashlib.sha256(f"{style_filter}|{seed_text}".encode("utf-8")).hexdigest()
    start = int(digest[:8], 16) % len(pool)
    rotated = pool[start:] + pool[:start]
    return rotated[:3]


def _normalize_tag_list(tags: list[str], max_len: int = 5) -> list[str]:
    en_to_ko = {
        "wedding": "웨딩스냅",
        "couple": "커플샷",
        "love": "러브무드",
        "engagement": "약혼무드",
        "bridal": "브라이덜무드",
        "whiteboard": "화이트보드",
        "office": "실내무드",
        "meeting": "수업기록",
        "presentation": "발표순간",
        "work": "일상기록",
        "car": "자동차",
        "vehicle": "자동차",
        "vintagecar": "빈티지카",
        "roadtrip": "로드트립",
        "modelpose": "포즈샷",
        "retrovibes": "레트로감성",
        "summertime": "여름무드",
    }

    def localize_tag(raw: str) -> str:
        token = re.sub(r"\s+", "", str(raw or "").strip().lstrip("#"))
        if not token:
            return ""
        lowered = token.lower()
        if lowered in en_to_ko:
            return en_to_ko[lowered]
        # 영어만으로 된 미등록 태그는 제거해 한글 태그 중심으로 유지
        if re.fullmatch(r"[a-z0-9_]+", lowered):
            return ""
        return token

    out: list[str] = []
    seen: set[str] = set()
    for raw in tags:
        tag = localize_tag(str(raw))
        if not tag:
            continue
        if tag.lower() in seen:
            continue
        seen.add(tag.lower())
        out.append(tag)
        if len(out) >= max_len:
            break
    return out


def _contains_food_signal(values: list[str]) -> bool:
    food_keywords = ("먹", "맛", "food", "meal", "dish", "restaurant", "카페", "디저트")
    joined = " ".join(values).lower()
    return any(k in joined for k in food_keywords)


def _contains_car_signal(values: list[str]) -> bool:
    car_keywords = ("차", "자동차", "car", "vehicle", "sedan", "suv", "coupe", "truck", "머스탱")
    joined = " ".join(values).lower()
    return any(k in joined for k in car_keywords)


def _drop_food_tags_when_not_food(tags: list[str], has_food_signal: bool) -> list[str]:
    if has_food_signal:
        return tags
    banned = ("먹", "맛", "food", "푸드", "카페")
    filtered = [t for t in tags if not any(b in t.lower() for b in banned)]
    return filtered or tags


def _dedupe_comment_text(text: str) -> str:
    text = _sanitize_for_post(text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for line in lines:
        norm = re.sub(r"\s+", " ", line).strip().lower()
        if not norm:
            continue
        if norm in seen:
            continue
        if any(norm in prev or prev in norm for prev in seen):
            continue
        seen.add(norm)
        deduped.append(line)
    if not deduped:
        return text.strip()
    merged = "\n\n".join(deduped)
    return _dedupe_sentences(merged)


def _sanitize_for_post(text: str) -> str:
    s = str(text or "").strip()
    banned_phrases = [
        "짧게 남기는 오늘의 여행 무드",
        "어딘가의 여행지",
    ]
    for phrase in banned_phrases:
        s = s.replace(phrase, "")
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _dedupe_sentences(text: str) -> str:
    chunks = [c.strip() for c in re.split(r"[\n]+", text) if c.strip()]
    out: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        parts = [p.strip() for p in re.split(r"(?<=[.!?…])\s+", chunk) if p.strip()]
        for part in parts:
            norm = re.sub(r"\s+", " ", part).strip().lower()
            if not norm:
                continue
            if norm in seen:
                continue
            if any(norm in prev or prev in norm for prev in seen):
                continue
            seen.add(norm)
            out.append(part)
    if not out:
        return text.strip()
    return "\n\n".join(out)


def _is_near_copy(candidate: str, source: str) -> bool:
    cand = re.sub(r"#[\w가-힣_]+", "", str(candidate or ""))
    src = re.sub(r"#[\w가-힣_]+", "", str(source or ""))
    cand = re.sub(r"[^0-9A-Za-z가-힣]+", "", cand).lower().strip()
    src = re.sub(r"[^0-9A-Za-z가-힣]+", "", src).lower().strip()
    if not cand or not src:
        return False

    shorter, longer = (cand, src) if len(cand) <= len(src) else (src, cand)
    if len(shorter) >= 16 and shorter in longer:
        return True

    ratio = SequenceMatcher(None, cand, src).ratio()
    if ratio >= 0.82:
        return True

    cand_tokens = set(re.findall(r"[0-9A-Za-z가-힣]{2,}", candidate.lower()))
    src_tokens = set(re.findall(r"[0-9A-Za-z가-힣]{2,}", source.lower()))
    if not cand_tokens or not src_tokens:
        return False
    inter = cand_tokens.intersection(src_tokens)
    union = cand_tokens.union(src_tokens)
    jaccard = (len(inter) / len(union)) if union else 0.0
    return jaccard >= 0.75


def _merge_seed_comments(user_comment: str, auto_comment: str) -> str:
    parts = [_sanitize_for_post(user_comment), _sanitize_for_post(auto_comment)]
    merged = "\n".join([p for p in parts if p]).strip()
    if not merged:
        return ""
    return _dedupe_sentences(merged)


def _extract_visual_signals_with_gpt(
    image_paths: list[str],
    key: str,
    max_images: int = 3,
) -> dict[str, list[str]]:
    valid_paths: list[Path] = []
    for raw in image_paths:
        p = Path(raw)
        if p.exists() and p.is_file():
            valid_paths.append(p)
        if len(valid_paths) >= max(1, min(max_images, 5)):
            break
    if not valid_paths:
        return {"objects": [], "scenes": [], "tags": []}

    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                "이미지들을 보고 JSON 객체만 출력해라. "
                "키는 objects/scenes/tags만 사용하고 각각 문자열 배열로 채워라.\n"
                "【엄격한 규칙】 사진에서 눈으로 직접 확인되는 피사체·장면만 기재한다. "
                "보이지 않는 것을 추측하거나 지어내는 것은 절대 금지.\n"
                "objects: 화면에 실제로 보이는 핵심 피사체(예: 자동차, 사람, 바다).\n"
                "scenes: 실제로 확인되는 장소·분위기(예: 실내, 도심, 야외, 낮).\n"
                "tags: 인스타 해시태그 후보 단어(해시 기호 없이) 4~8개, 반드시 한국어만.\n"
                "음식이 화면에 명확히 보일 때만 음식 관련 태그를 넣어라."
            ),
        }
    ]
    for p in valid_paths:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": _image_to_data_url(p), "detail": "low"},
            }
        )

    body = {
        "model": "gpt-5-mini",
        "messages": [
            {"role": "system", "content": "너는 여행 사진 시각 분석가다. 반드시 JSON만 출력한다."},
            {"role": "user", "content": content},
        ],
        "max_completion_tokens": 400,
        "reasoning_effort": "low",
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=35.0) as client:
            res = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
            res.raise_for_status()
            data = res.json()
    except Exception:
        logger.exception("Visual signal extraction failed. fallback to style tags only.")
        return {"objects": [], "scenes": [], "tags": []}

    choices = data.get("choices") or []
    content_text = ""
    if choices:
        message = choices[0].get("message") or {}
        content_text = str(message.get("content") or "")
    parsed = _extract_json_object(content_text)
    objects = [str(x).strip() for x in (parsed.get("objects") or []) if str(x).strip()]
    scenes = [str(x).strip() for x in (parsed.get("scenes") or []) if str(x).strip()]
    tags = [str(x).strip().lstrip("#") for x in (parsed.get("tags") or []) if str(x).strip()]
    return {
        "objects": objects[:8],
        "scenes": scenes[:8],
        "tags": _normalize_tag_list(tags, max_len=8),
    }


def _pick_style_headline(style_filter: str, seed_text: str) -> str:
    normalized = _normalize_style_filter(style_filter)
    headlines = list((_MBTI_INSTAGRAM_GUIDES.get(normalized) or {}).get("headline_examples") or [])
    if not headlines:
        return "오늘의 여행 한 컷"
    digest = hashlib.sha256(f"{normalized}|{seed_text}".encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(headlines)
    return str(headlines[idx]).strip()


def _normalize_generated_title(title: str, style_filter: str, seed_text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (title or "").strip())
    generic_titles = {"오늘의 여행 한 컷", "여행 한 컷 저장", "오늘 기록", "여행 기록"}
    if not cleaned or cleaned in generic_titles:
        return _pick_style_headline(style_filter, seed_text)
    if len(cleaned) < 6:
        return _pick_style_headline(style_filter, seed_text)
    return cleaned


def _normalize_generated_line1(line1: str, fallback_base: str, style_filter: str) -> str:
    cleaned = re.sub(r"\s+", " ", (line1 or "").strip())
    if cleaned and len(cleaned) >= 10:
        return cleaned

    normalized = _normalize_style_filter(style_filter)
    tone_seed = {
        "INTJ": "핵심만 남기면 길이 보임",
        "INTP": "문득 든 질문 하나 기록",
        "ENTJ": "오늘도 실행으로 증명",
        "ENTP": "상식 한 번 뒤집어봄",
        "INFJ": "조용한 장면이 오래 남음",
        "INFP": "작은 무드도 오늘의 우주",
        "ENFJ": "함께라서 더 단단해짐",
        "ENFP": "지금 텐션 그대로 저장",
        "ISTJ": "루틴은 결과로 이어짐",
        "ISFJ": "소중한 마음부터 챙김",
        "ESTJ": "체크리스트 또 한 줄 완료",
        "ESFJ": "좋은 사람들과 채운 하루",
        "ISTP": "말보다 결과물 한 장",
        "ISFP": "느린 결의 색을 담음",
        "ESTP": "망설임 없이 바로 시작",
        "ESFP": "오늘 무드의 하이라이트",
    }
    fallback = tone_seed.get(normalized, "").strip()
    if fallback:
        return fallback
    return fallback_base.strip() or "오늘 무드 한 줄 기록"


def _normalize_instagram_comment(line1: str, line2: str, fallback: str, style_filter: str) -> str:
    profile = _style_profile(style_filter)

    def clip_line(s: str, limit: int = 30) -> str:
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) <= limit:
            return s
        return s[:limit].rstrip() + "…"

    def to_casual(line: str) -> str:
        s = line.strip()
        # 블로그/존댓말 종결을 인스타 감성의 반말/명사형으로 보정
        direct_replacements = [
            ("했습니다", "했음"),
            ("했어요", "했음"),
            ("입니다", "임"),
            ("이에요", "임"),
            ("예요", "임"),
            ("좋았어요", "좋았음"),
            ("좋았습니다", "좋았음"),
            ("같아요", "같음"),
            ("있어요", "있음"),
        ]
        for src, dst in direct_replacements:
            s = s.replace(src, dst)

        replacements = [
            (r"합니다([.!?…]?)$", r"함\1"),
            (r"했습니다([.!?…]?)$", r"했음\1"),
            (r"했어요([.!?…]?)$", r"했음\1"),
            (r"였습니다([.!?…]?)$", r"였음\1"),
            (r"이에요([.!?…]?)$", r"임\1"),
            (r"예요([.!?…]?)$", r"임\1"),
            (r"입니다([.!?…]?)$", r"임\1"),
            (r"좋았습니다([.!?…]?)$", r"좋았음\1"),
            (r"좋았어요([.!?…]?)$", r"좋았음\1"),
            (r"같아요([.!?…]?)$", r"같음\1"),
            (r"있어요([.!?…]?)$", r"있음\1"),
        ]
        for pattern, repl in replacements:
            s = re.sub(pattern, repl, s)
        return s

    main_line = (line1.strip() or fallback).strip()
    detail_line = (line2.strip() or "").strip()
    if not detail_line:
        detail_line = f"{fallback.strip()}의 디테일을 가볍게 남김."
    if profile["force_casual"]:
        main_line = to_casual(main_line)
        detail_line = to_casual(detail_line)
    else:
        main_line = re.sub(r"\s+", " ", main_line).strip()
        detail_line = re.sub(r"\s+", " ", detail_line).strip()

    if profile["bucket"] == "trendy" and not re.search(r"[!?]$", main_line):
        main_line = f"{main_line}!"
    line_suffix = str(profile.get("line_suffix") or "")
    if line_suffix and line_suffix.strip() and line_suffix.strip() not in main_line:
        main_line = f"{main_line}{line_suffix}"

    main_line = clip_line(main_line, int(profile["main_limit"]))
    detail_line = clip_line(detail_line, int(profile["detail_limit"]))
    return f"{main_line}\n\n{detail_line}"


def _ensure_instagram_length(comment_text: str, style_filter: str, fallback_base: str) -> str:
    # 해시태그 이전 본문 기준으로 100~300자 가이드라인을 맞춘다.
    plain = re.sub(r"#[\w가-힣_]+", "", comment_text).strip()
    if len(plain) >= 100:
        return comment_text

    bucket = _tone_bucket(_normalize_style_filter(style_filter))
    addon_map = {
        "info": "동선, 비용, 시간까지 정리해두면 다음 일정이 훨씬 가벼워진다.",
        "trendy": "짧게 남겨도 분위기는 확실하게, 오늘 무드는 지금이 정답.",
        "emotional": "작은 장면 하나가 오래 남는 이유를, 오늘은 더 또렷하게 느꼈다.",
        "default": "짧은 기록도 쌓이면 그날의 분위기를 다시 꺼내보게 된다.",
    }
    addon = addon_map.get(bucket, addon_map["default"])
    extended = f"{comment_text}\n\n{addon}"
    return extended.strip()


def _normalize_style_filter(style_filter: str | None) -> str:
    value = (style_filter or "AUTO").strip().upper()
    if value in _MBTI_TYPES:
        return value
    return "AUTO"


def _load_style_templates() -> dict[str, str]:
    templates = dict(_DEFAULT_STYLE_GUIDES)
    if not _STYLE_TEMPLATE_FILE.exists():
        return templates
    try:
        parsed = json.loads(_STYLE_TEMPLATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return templates
    if not isinstance(parsed, dict):
        return templates
    for key, value in parsed.items():
        k = str(key).strip().upper()
        if k not in _MBTI_TYPES and k != "AUTO":
            continue
        v = str(value).strip()
        if v:
            templates[k] = v
    return templates


def _build_style_guide(style_filter: str, style_template: str | None) -> tuple[str, str]:
    normalized = _normalize_style_filter(style_filter)
    # 사용자가 직접 템플릿을 넘기면 최우선 사용
    if style_template and style_template.strip():
        return normalized, style_template.strip()

    if normalized in _MBTI_INSTAGRAM_GUIDES:
        return normalized, _render_mbti_style_guide(normalized)

    templates = _load_style_templates()
    if normalized in templates:
        return normalized, templates[normalized]
    return normalized, templates["AUTO"]


def _extract_json_object(text: str) -> dict:
    def _pick_dict(value: Any) -> dict:
        if isinstance(value, dict):
            return value
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    return item
        return {}

    text = text.strip()
    if not text:
        return {}

    candidates = [text]
    fenced = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    candidates.extend(c.strip() for c in fenced if c and c.strip())

    for candidate in candidates:
        try:
            picked = _pick_dict(json.loads(candidate))
            if picked:
                return picked
        except Exception:
            continue

    # 완전한 JSON 파싱이 실패하면, 첫 번째 객체 조각이라도 살린다.
    for match in re.finditer(r"\{[\s\S]*?\}", text):
        snippet = match.group(0).strip()
        if not snippet:
            continue
        try:
            picked = _pick_dict(json.loads(snippet))
            if picked:
                return picked
        except Exception:
            continue
    return {}


def _image_to_data_url(path: Path) -> str:
    guessed = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    payload = b64encode(path.read_bytes()).decode("ascii")
    return f"data:{guessed};base64,{payload}"


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        pass
    try:
        num = getattr(value, "numerator")
        den = getattr(value, "denominator")
        return float(num) / float(den) if den else 0.0
    except Exception:
        return 0.0


def _dms_to_decimal(dms: Any) -> float | None:
    if not isinstance(dms, (list, tuple)) or len(dms) < 3:
        return None
    deg = _to_float(dms[0])
    minute = _to_float(dms[1])
    second = _to_float(dms[2])
    return deg + (minute / 60.0) + (second / 3600.0)


def _extract_gps_coordinates(image_path: Path) -> tuple[float, float] | None:
    try:
        with Image.open(image_path) as img:
            exif = img.getexif()
            if not exif:
                return None
            gps_info = exif.get(_GPS_INFO_TAG)
            if not gps_info:
                return None
            if hasattr(gps_info, "items"):
                gps_raw = dict(gps_info.items())
            elif isinstance(gps_info, dict):
                gps_raw = gps_info
            else:
                return None
    except Exception:
        return None

    gps_named: dict[str, Any] = {}
    for key, value in gps_raw.items():
        name = ExifTags.GPSTAGS.get(key, str(key))
        gps_named[name] = value

    lat = _dms_to_decimal(gps_named.get("GPSLatitude"))
    lon = _dms_to_decimal(gps_named.get("GPSLongitude"))
    if lat is None or lon is None:
        return None

    lat_ref = str(gps_named.get("GPSLatitudeRef", "N")).upper()
    lon_ref = str(gps_named.get("GPSLongitudeRef", "E")).upper()
    if lat_ref.startswith("S"):
        lat = -lat
    if lon_ref.startswith("W"):
        lon = -lon
    return lat, lon


def _reverse_geocode(lat: float, lon: float) -> str:
    try:
        with httpx.Client(
            timeout=8.0,
            headers={"User-Agent": "kroaddy-tourstar/1.0 (gps-location-hint)"},
        ) as client:
            res = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "format": "jsonv2",
                    "lat": f"{lat:.7f}",
                    "lon": f"{lon:.7f}",
                    "zoom": 12,
                    "addressdetails": 1,
                    "accept-language": "ko,en",
                },
            )
            res.raise_for_status()
            data = res.json()
    except Exception:
        return ""

    address = data.get("address") or {}
    state = str(address.get("state") or "").strip()
    city = str(
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("county")
        or ""
    ).strip()
    if state and city:
        return f"{state} {city}"
    if city:
        return city
    if state:
        return state
    display_name = str(data.get("display_name") or "").strip()
    if display_name:
        return display_name.split(",")[0].strip()
    return ""


def _infer_location_hint_from_gps(image_paths: list[Path]) -> tuple[str, list[dict]]:
    if not image_paths:
        return "", []
    graph = build_metadata_graph()
    state = graph.invoke(
        {
            "image_paths": [str(p) for p in image_paths],
            "metadata_only": True,
        }
    )
    hint = str(state.get("location_hint") or "").strip()
    candidates = list(state.get("location_candidates") or [])
    return hint, candidates


def _generate_auto_comment_with_gpt(image_paths: list[str], max_images: int = 3) -> AutoCommentResponse:
    valid_paths: list[Path] = []
    for raw in image_paths:
        p = Path(raw)
        if p.exists() and p.is_file():
            valid_paths.append(p)
        if len(valid_paths) >= max(1, min(max_images, 5)):
            break

    gps_location_hint, gps_candidates = _infer_location_hint_from_gps(valid_paths)

    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        logger.warning(
            "Auto-comment fallback: OPENAI_API_KEY is missing. valid_paths=%d, gps_candidates=%d",
            len(valid_paths),
            len(gps_candidates),
        )
        fallback = (
            f"{gps_location_hint}에서 남긴 오늘 여행 무드 기록 ✨"
            if gps_location_hint
            else "오늘 여행 무드가 좋아서 기록 남김 ✨"
        )
        return AutoCommentResponse(
            comment=fallback,
            location_hint=gps_location_hint,
            gps_candidates=gps_candidates,
        )

    if not valid_paths:
        logger.warning(
            "Auto-comment fallback: no valid image paths in request. requested=%d",
            len(image_paths),
        )
        return AutoCommentResponse(
            comment="오늘 여행 무드가 좋아서 기록 남김 ✨",
            location_hint=gps_location_hint,
            gps_candidates=gps_candidates,
        )

    content: list[dict] = [
        {
            "type": "text",
            "text": (
                "아래 여행 사진들을 보고 JSON으로만 답해라. "
                "키는 comment/location_hint/mood/time_of_day만 사용한다.\n"
                "【엄격한 규칙】\n"
                "1) 사진에서 눈으로 직접 확인되는 것만 서술한다. "
                "보이지 않는 요소(예: 사진에 없는 사람·사물·행동·표정)를 추측하거나 지어내는 것은 절대 금지.\n"
                "2) 인물이 취하는 자세·행동은 사진에서 분명히 보이는 경우에만 언급한다.\n"
                "3) comment는 한국어 1줄(20~45자), 인스타 감성, 존댓말 금지.\n"
                "4) 지역(예: 부산/해운대), 인물 표정(밝음/차분함), 낮/밤, 전체 분위기를 반영해라.\n"
                "5) 지역이 불명확하면 location_hint는 '위치 미확인'으로 써라.\n"
                f"{('6) GPS 힌트: ' + gps_location_hint) if gps_location_hint else ''}"
            ),
        }
    ]
    for path in valid_paths:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": _image_to_data_url(path), "detail": "low"},
            }
        )

    body = {
        "model": "gpt-5-mini",
        "messages": [
            {"role": "system", "content": "너는 여행 사진 캡션 분석가다. 반드시 JSON만 출력한다."},
            {"role": "user", "content": content},
        ],
        "max_completion_tokens": 900,
        "reasoning_effort": "low",
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=40.0) as client:
            res = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPStatusError as exc:
        body_preview = (exc.response.text or "")[:800]
        logger.error(
            "Auto-comment OpenAI HTTP error: status=%s body=%s",
            exc.response.status_code,
            body_preview,
        )
        raise
    except httpx.TimeoutException:
        logger.error(
            "Auto-comment OpenAI timeout: timeout=%ss, images=%d",
            40,
            len(valid_paths),
        )
        raise
    except Exception:
        logger.exception("Auto-comment OpenAI request failed unexpectedly")
        raise

    choices = data.get("choices") or []
    finish_reason = ""
    content_text = ""
    if choices:
        finish_reason = str(choices[0].get("finish_reason") or "")
        message = choices[0].get("message") or {}
        content_text = str(message.get("content") or "")
    if not content_text:
        logger.warning(
            "Auto-comment empty content from OpenAI. finish_reason=%s usage=%s",
            finish_reason,
            data.get("usage"),
        )

    parsed = _extract_json_object(content_text)
    if not parsed:
        logger.warning(
            "Auto-comment parse warning: empty JSON parsed. content_preview=%s",
            content_text[:400],
        )
    comment = str(parsed.get("comment") or "").strip() or "오늘 여행 무드가 좋아서 기록 남김 ✨"
    location_hint = str(parsed.get("location_hint") or "").strip()
    mood = str(parsed.get("mood") or "").strip()
    time_of_day = str(parsed.get("time_of_day") or "").strip()
    if gps_location_hint:
        location_hint = gps_location_hint
    return AutoCommentResponse(
        comment=comment,
        location_hint=location_hint,
        mood=mood,
        time_of_day=time_of_day,
        gps_candidates=gps_candidates,
    )


def _generate_post_with_gpt(
    comment: str,
    style_filter: str | None = None,
    style_template: str | None = None,
    image_paths: list[str] | None = None,
) -> GeneratePostResponse:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")

    normalized_filter, style_guide = _build_style_guide(style_filter or "AUTO", style_template)
    seed_comment = _sanitize_for_post(comment)
    safe_image_paths = [str(p) for p in (image_paths or []) if str(p).strip()]

    # ── 1. 자동코멘트 생성 (이미 잘 동작 중인 단계) ──────────────────────────
    auto_comment = AutoCommentResponse(comment="")
    try:
        auto_comment = _generate_auto_comment_with_gpt(safe_image_paths, max_images=3)
    except Exception:
        logger.exception("Generate-post: auto-comment context failed. continue with user seed only.")

    # ── 2. 시각 신호 추출 ───────────────────────────────────────────────────
    visual = _extract_visual_signals_with_gpt(safe_image_paths, key, max_images=3)
    visual_objects = list(visual.get("objects") or [])
    visual_scenes = list(visual.get("scenes") or [])
    visual_tags = list(visual.get("tags") or [])
    visual_all = visual_objects + visual_scenes + visual_tags
    has_food_signal = _contains_food_signal(visual_all)
    has_car_signal = _contains_car_signal(visual_all)

    subjects_str = ", ".join(visual_objects[:5]) or "없음"
    scenes_str = ", ".join(visual_scenes[:5]) or "없음"

    # ── 3. MBTI 스타일 가이드 & few-shot ───────────────────────────────────
    hard_constraints = _mbti_prompt_constraints(normalized_filter)

    # ── 4. 프롬프트 구성 ────────────────────────────────────────────────────
    system_prompt = (
        "너는 인스타그램 자동 포스팅 서비스 MBTI-Gram의 작가다.\n"
        "아래 [자동코멘트]는 AI가 사진을 분석해 만든 한 줄 요약이다. "
        "이것을 원재료로 삼아, 선택된 MBTI 캐릭터가 직접 쓴 것 같은 인스타그램 피드 게시글로 변환하라.\n\n"
        "출력 형식: JSON 객체 1개만. 키는 title / location / body / tags 만 사용.\n\n"
        "작성 규칙:\n"
        "- title: 10~20자, 사진 핵심 피사체 키워드 포함, 이모지 0~1개, generic 문구 금지\n"
        "- location: 사진/코멘트에서 추론 가능하면 구체적으로, 없으면 '위치 미확인'\n"
        "- body: MBTI 캐릭터 고유 문체로 100~250자 인스타 피드 본문. "
        "블로그 문체(~했어요/~입니다) 금지. 자동코멘트를 그대로 복붙하지 말고 MBTI 톤으로 완전히 재작성. "
        "사실 근거(피사체/장면/행동)는 자동코멘트·사진분석 범위를 벗어나지 마라. "
        "다만 감정 표현/비유/리듬은 MBTI 톤에 맞게 자유롭게 살려라.\n"
        "- 본문은 사람이 실제로 올린 피드처럼 자연스러워야 한다. "
        "AI가 쓴 티가 나는 과한 정리체/설명체/교과서체를 피하고, "
        "일상적인 어휘와 구어체 리듬을 사용해 자연스럽게 이어 써라.\n"
        "- tags: 해시 기호 없이 한국어 3~5개. 사진 피사체·장면 반영. MBTI 명칭 금지. 음식 미존재 시 음식 태그 금지.\n"
        "- MBTI가 다르면 문체·어휘·감정 표현 방식이 분명히 달라야 한다.\n"
        "- MBTI 명칭(INFJ/ESTP 등)을 본문과 태그에 직접 쓰지 마라.\n"
        "- 같은 문장·표현 반복 금지."
    )

    user_prompt = (
        f"[MBTI 프리셋]: {normalized_filter}\n\n"
        f"[MBTI 스타일 가이드]\n{style_guide}\n\n"
        f"[MBTI 문체 제약]\n{hard_constraints}\n\n"
        f"[자동코멘트 — 변환 원재료]\n{auto_comment.comment or '없음'}\n\n"
        f"[사용자 메모]\n{seed_comment or '없음'}\n\n"
        f"[사진 분석]\n"
        f"- 핵심 피사체: {subjects_str}\n"
        f"- 장면/분위기: {scenes_str}\n"
        f"- 위치 힌트: {auto_comment.location_hint or '없음'}\n"
        f"- 시간대/무드: {auto_comment.time_of_day or '없음'} / {auto_comment.mood or '없음'}\n"
        f"- 차량 포함: {'예' if has_car_signal else '아니오'}\n"
        f"- 음식 포함: {'예' if has_food_signal else '아니오'}\n\n"
        f"[{normalized_filter} 스타일 게시글 예시 — 이 톤·문체·에너지를 반드시 따를 것]\n"
        f"{_few_shot_example(normalized_filter)}\n\n"
        "⚠️ 위 예시의 문장을 그대로 쓰지 말고, 반드시 [자동코멘트]와 [사진 분석]을 바탕으로 새롭게 작성할 것.\n"
        "위 MBTI 스타일로 [자동코멘트]를 인스타 피드 감성으로 변환해줘. "
        "사실은 정확하게, 문체와 감정선은 MBTI 캐릭터답게 강하게 살려 JSON으로 출력해줘."
    )

    body = {
        "model": "gpt-5-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_completion_tokens": 900,
        "reasoning_effort": "low",
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=25.0) as client:
            res = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPStatusError as exc:
        body_preview = (exc.response.text or "")[:1200]
        logger.error(
            "Generate-post OpenAI HTTP error: status=%s body=%s",
            exc.response.status_code,
            body_preview,
        )
        raise
    except httpx.TimeoutException:
        logger.error(
            "Generate-post OpenAI timeout: timeout=%ss, images=%d",
            25,
            len(safe_image_paths),
        )
        raise
    except Exception:
        logger.exception("Generate-post OpenAI request failed unexpectedly")
        raise

    choices = data.get("choices") or []
    finish_reason = ""
    content = ""
    if choices:
        finish_reason = str(choices[0].get("finish_reason") or "")
        message = choices[0].get("message") or {}
        content = str(message.get("content") or "")
    if not content:
        logger.warning(
            "Generate-post empty content from OpenAI. finish_reason=%s usage=%s",
            finish_reason,
            data.get("usage"),
        )

    # ── 5. 결과 파싱 — GPT 출력을 최대한 직접 사용 ────────────────────────
    parsed = _extract_json_object(content)

    # title
    raw_title = _sanitize_for_post(str(parsed.get("title") or "").strip())
    generic_titles = {"오늘 기록", "오늘의 기록", "오늘 여행 기록", "오늘 주인공은 나", "오늘 주인공은 나!"}
    if not raw_title or raw_title in generic_titles:
        visual_hint = str(visual_objects[0]).strip() if visual_objects else (
            str(visual_scenes[0]).strip() if visual_scenes else ""
        )
        style_headline = _pick_style_headline(
            normalized_filter,
            f"{seed_comment}|{auto_comment.comment}|{subjects_str}|{scenes_str}",
        )
        if visual_hint and visual_hint not in style_headline:
            raw_title = _sanitize_for_post(f"{style_headline} · {visual_hint}")
        else:
            raw_title = _sanitize_for_post(style_headline or f"{visual_hint} 무드 기록")
    title = raw_title

    # location
    raw_location = _sanitize_for_post(str(parsed.get("location") or "").strip())
    location = raw_location or _sanitize_for_post(auto_comment.location_hint) or "위치 미확인"

    # body — GPT 가 직접 쓴 본문을 그대로 사용, 최소 정제만
    raw_body = _sanitize_for_post(str(parsed.get("body") or "").strip())
    if not raw_body:
        # body 없으면 line1/line2 fallback (이전 형식 호환)
        l1 = _sanitize_for_post(str(parsed.get("line1") or "").strip())
        l2 = _sanitize_for_post(str(parsed.get("line2") or "").strip())
        raw_body = f"{l1}\n\n{l2}".strip() if (l1 or l2) else (
            auto_comment.comment or seed_comment or "오늘 여행 기록"
        )
    out_comment = _dedupe_comment_text(raw_body)

    # tags
    tags_raw = parsed.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [str(t).strip().lstrip("#") for t in tags_raw if str(t).strip()][:6]

    style_fallback = _default_tags_for_style(
        normalized_filter,
        f"{title}|{out_comment}|{seed_comment}|{auto_comment.comment}",
    )
    tags = _normalize_tag_list(tags + style_fallback + visual_tags, max_len=5)
    tags = _drop_food_tags_when_not_food(tags, has_food_signal)

    # MBTI 프리셋 선택 시 라이프스타일 태그가 최소 1개는 포함되도록 보정
    if normalized_filter != "AUTO":
        style_set = {t.lower() for t in style_fallback}
        if not any(t.lower() in style_set for t in tags):
            tags = _normalize_tag_list(style_fallback[:2] + tags, max_len=5)
            tags = _drop_food_tags_when_not_food(tags, has_food_signal)

    if len(tags) < 3:
        tags = _normalize_tag_list(tags + ["여행기록", "감성스냅", "오늘의무드"], max_len=5)

    # 해시태그 본문 추가
    hashtag_line = " ".join(f"#{tag}" for tag in tags[:5])
    if hashtag_line not in out_comment:
        out_comment = f"{out_comment}\n\n{hashtag_line}"

    return GeneratePostResponse(
        title=title or "오늘 여행 기록",
        location=location,
        comment=out_comment,
        tags=tags,
    )


@router.post("/jobs", response_model=JobStatusResponse)
def create_job(req: EvaluationRequest, idempotency_key: str | None = Header(default=None)) -> JobStatusResponse:
    if idempotency_key:
        existing = store.get_by_idempotency_key(idempotency_key)
        if existing is not None:
            return existing

    job_id = uuid4().hex
    job = JobStatusResponse(
        job_id=job_id,
        status="queued",
        requested_at=datetime.now(),
        max_retries=req.max_retries,
    )
    store.put(job, idempotency_key=idempotency_key)
    worker.enqueue(job_id, req)
    return job


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str) -> JobStatusResponse:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job


@router.post("/uploads", response_model=UploadPhotosResponse)
async def upload_photos(files: list[UploadFile] = File(...)) -> UploadPhotosResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    batch_id = datetime.now().strftime("%Y%m%d_%H%M%S") + f"_{uuid4().hex[:8]}"
    batch_dir = uploads_dir / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)

    saved: list[UploadedPhoto] = []
    for file in files:
        content = await file.read()
        if not content:
            continue

        content_type = (file.content_type or "").lower()
        allowed_types = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/bmp": "bmp",
        }
        ext = allowed_types.get(content_type)
        if ext is None:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.filename}")

        name = f"{uuid4().hex}.{ext}"
        dst = batch_dir / name
        dst.write_bytes(content)

        saved.append(
            UploadedPhoto(
                name=file.filename or name,
                url=f"/tourstar-files/uploads/{batch_id}/{name}",
                size=len(content),
            )
        )

    if not saved:
        raise HTTPException(status_code=400, detail="No valid image files uploaded.")

    # 업로드 완료 후 즉시 사진 판독 파이프라인 큐잉
    job_id = uuid4().hex
    job = JobStatusResponse(
        job_id=job_id,
        status="queued",
        requested_at=datetime.now(),
        max_retries=1,
    )
    store.put(job)
    worker.enqueue(
        job_id,
        EvaluationRequest(
            input_dir=str(batch_dir),
            top_k=min(3, len(saved)),
            max_images=len(saved),
        ),
    )

    return UploadPhotosResponse(
        uploaded=saved,
        batch_dir=str(batch_dir),
        pipeline_job=UploadPipelineJob(job_id=job_id, status="queued"),
    )


@router.post("/generate-post", response_model=GeneratePostResponse)
def generate_post(req: GeneratePostRequest) -> GeneratePostResponse:
    return _generate_post_with_gpt(req.comment, req.style_filter, req.style_template, req.image_paths)


@router.post("/auto-comment", response_model=AutoCommentResponse)
def generate_auto_comment(req: AutoCommentRequest) -> AutoCommentResponse:
    try:
        return _generate_auto_comment_with_gpt(req.image_paths, req.max_images)
    except Exception:
        logger.exception("Auto-comment failed. Returning fallback comment.")
        # 자동 코멘트는 보조 기능이므로 실패 시에도 기본 문구를 반환한다.
        return AutoCommentResponse(comment="오늘 여행 무드가 좋아서 기록 남김 ✨")

