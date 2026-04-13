# Standard 플래너 아키텍처 (현행)

서비스 루트: `backend/planer.kroaddy.site/`. **FastAPI**가 `app/api/v1/standard/routes.py`에서 L1/L2 캐시·스트리밍·LangGraph 호출을 조율하고, **LangGraph**는 `app/agent/standard/` 아래 두 그래프(`routes_graph`, `schedule_graph`)로 루트/일정을 생성한다. 상태 타입은 공통 `PlannerState`(TypedDict).

---

## 0. 진입점·생명주기

| 구분 | 위치 |
|------|------|
| 앱 | `app/main.py` — `FastAPI(lifespan=...)` |
| 기동 시 | `init_schedule_graph_checkpoint()` — `LANGGRAPH_REDIS_URL`이 있으면 `AsyncRedisSaver`로 `schedule_graph`를 **다시 컴파일**해 교체 |
| 종료 시 | `close_schedule_graph_checkpoint()` — Redis 컨텍스트 종료 후 무체크포인트 그래프로 복귀 |
| 공유 HTTP 클라이언트 | Kakao / Naver / News / Weather / user_info / **Upstash(httpx)** 등 `close_*` |

라우터는 **`from app.agent.standard import graph as std_graph`** 로 모듈을 참조하므로, lifespan 이후 **`std_graph.schedule_graph`** 가 항상 최신 컴파일 인스턴스를 가리킨다.

---

## 1. 파일 구성

| 파일 | 역할 |
|------|------|
| `graph.py` | `build_schedule_graph(checkpointer=...)`, `routes_graph`, 기본 `schedule_graph` |
| `graph_checkpoint.py` | Redis 체크포인터 `init` / `close`, `schedule_checkpoint_active()` |
| `state.py` | `PlannerState` |
| `nodes_routes.py` | `generate_routes` |
| `nodes_schedule.py` | `gather_context_node`, `generate_schedule`, `geocode_schedule`, 영업시간 등 |
| `nodes_common.py` | Gemini, `modify_schedule` / `reroll_single_item` 등 |
| `app/services/upstash_redis.py` | Upstash **REST** GET/SETEX/DEL (POI L0 캐시 등) |
| `app/api/v1/standard/routes.py` | L1/L2 캐시, SSE 스트림, `thread_id`, gather 스냅샷 |
| `app/core/config.py` | Redis·LangGraph 관련 설정 필드 |

---

## 2. 상태: `PlannerState`

### 요청·옵션

- `location`, `location_name`, `user_id`, `route_name`, `start_date`, `end_date`
- `transport_mode` (`car` | `transit` | `walk`)
- `use_search` — True일 때 gather에서 Gemini+Google Search로 웹 맥락 수집

HTTP **`ScheduleRequest`** 에는 추가로 **`thread_id`**(선택)가 있으며, 비스트리밍 일정 생성 시 LangGraph `configurable.thread_id` 및 응답 JSON에 사용된다.

### `gather_context` 이후 채워지는 필드

| 필드 | 출처 |
|------|------|
| `user_profile` | user_info |
| `festivals` | 가이드/DB 캐시 기반 행사 |
| `news_top10` | 뉴스 서비스 또는 요청 본문 |
| `weather_forecast` | OpenWeatherMap |
| `web_search_context` | `_gather_web_search_context` (선택) |
| `web_search_gather_attempted` | 웹 수집 시도 여부 |
| `kakao_poi_context_block` | 카카오 키워드 POI 풀 텍스트 |

### 생성 결과

- `routes`, `schedule`, `cost_summary`, `error`
- `existing_routes` — 루트 그래프 전용

---

## 3. 그래프 A: 루트 (`routes_graph`)

행사/뉴스/날씨는 호출하지 않는다.

```mermaid
flowchart LR
  START([START]) --> GR[generate_routes]
  GR --> END([END])
```

---

## 4. 그래프 B: 일정 (`schedule_graph`)

선형 파이프라인. **일차별 LLM은 순차**, **지오코딩은 항목 단위 병렬**.

```mermaid
flowchart TD
  START([START]) --> GC[gather_context]
  GC --> GS[generate_schedule]
  GS --> GEO[geocode_schedule]
  GEO --> ENR[enrich_business_hours]
  ENR --> END([END])
```

### 체크포인트(선택)

- `LANGGRAPH_REDIS_URL`(TCP, 예: `rediss://default:...@host:6379`)이 설정되고 `langgraph-checkpoint-redis`의 `AsyncRedisSaver.asetup()`이 성공하면, 위 그래프가 **체크포인터와 함께** 컴파일된다.
- `POST .../schedule` 호출 시 `{"configurable": {"thread_id": "<고정 ID>"}}` 로 `ainvoke` — 동일 `thread_id`로 재호출 시 **마지막 노드 이후**부터 이어갈 수 있다.
- 공식 Redis saver는 **RedisJSON·RediSearch**(또는 Redis 8+)를 요구한다. 인스턴스가 조건을 만족하지 않으면 로그 후 **무체크포인트 그래프**로 폴백한다.

### 4.1 `gather_context` (`gather_context_node`)

1. **1차 `asyncio.gather`**: 프로필, 행사, 뉴스, 날씨  
2. **언어 확정** — `_get_lang(profile)`  
3. **2차 `asyncio.gather`**: 웹(`use_search`), 카카오 POI 풀 `_gather_kakao_poi_pool_block`  
   - LLM(옵션 `kakao_poi_anchor_use_llm`)이 **앵커**를 고른 뒤 고정 3쿼리 ``{앵커} 관광지`` / ``{앵커} 맛집`` / ``{앵커} 카페``로 RAG용 블록 수집. **`UPSTASH_REDIS_REST_*`** 시 앵커·루트·언어 기준 L0 캐시(`redis_cache_ttl_poi_sec`).

### 4.2 ~ 4.4

`generate_schedule` → `geocode_schedule`(카카오 1순위·네이버 2순위, 실패 시 `_fix_failed_places`) → 옵션 `enrich_business_hours` — 기존과 동일.

---

## 5. HTTP 계층: 캐시·두 가지 일정 경로

```mermaid
flowchart TB
  subgraph api["routes.py"]
    L1[L1 메모리 캐시]
    L2[L2 Neon ScheduleCache]
    BR{캐시 히트?}
  end
  JSON["POST .../schedule"]
  SSE["POST .../schedule/stream"]
  LG["LangGraph schedule_graph"]
  MAN["수동: gather + Day 루프 + geocode"]

  JSON --> BR
  SSE --> BR
  BR -->|히트| OUT[즉시 반환]
  BR -->|미스| JSON
  BR -->|미스| SSE
  JSON --> LG
  SSE --> MAN
```

| 엔드포인트 | 일정 생성 방식 | 재개·맥락 |
|------------|----------------|-----------|
| `POST /api/v1/planner/{location}/schedule` | **`schedule_graph.ainvoke`** | Redis 체크포인트 활성 시 동일 `thread_id`로 LangGraph 재개. 응답에 `thread_id` 포함. |
| `POST /api/v1/planner/{location}/schedule/stream` | **`gather_context_node`** + `_generate_single_day` 루프 (그래프의 `generate_schedule` 노드와는 별 루트) | 첫 이벤트 `run`에 `thread_id` 발급. gather 직후 맥락을 **Upstash REST** JSON으로 저장; 동일 `thread_id`+`sched_key`로 재요청 시 gather 생략. **Day 중간**은 현재 스냅샷 없음. |

캐시 키(`sched_key`)는 위치·루트명·기간·언어·교통·검색 플래그 등으로 구성된다(`routes.py` 참고).

---

## 6. Redis·Upstash 이중 경로

| 목적 | 프로토콜 | 환경 변수 | 구현 |
|------|-----------|-----------|------|
| POI 문자열 L0, SSE gather 스냅샷 | **HTTPS REST** | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `app/services/upstash_redis.py` |
| LangGraph 노드 체크포인트 | **Redis TCP + TLS** | `LANGGRAPH_REDIS_URL` (`rediss://...`) | `langgraph-checkpoint-redis` / `graph_checkpoint.py` |

추가 설정: `REDIS_CACHE_TTL_POI_SEC`, `REDIS_STREAM_GATHER_TTL_SEC`(스트림 gather 스냅샷 TTL, 기본 7200).

스트림 완료 시 gather 스냅샷 키는 DEL로 정리한다.

---

## 7. SSE 이벤트 요약 (`/schedule/stream`)

| 타입 | 설명 |
|------|------|
| `run` | `thread_id`, `langgraph_checkpoint`(bool), 안내 메시지 |
| `status` | 진행 메시지 |
| `day` | 일차별 생성 결과 |
| `geocoded` | 좌표 반영 후 일정 |
| `cost_summary` | 비용 요약 |
| `cached` / `error` / `done` | 기존과 동일 |

---

## 8. LLM·외부 서비스 요약

| 구분 | 용도 |
|------|------|
| **Gemini** | 루트·일차 JSON·웹 맥락·실패 장소 대체 등 |
| **Google Search** | `use_search` 시 웹 맥락 |
| **카카오 로컬** | POI 풀·지오코딩 1순위 |
| **네이버 Maps** | 지오코딩 2순위·(옵션) 영업시간 |
| **OpenWeatherMap** | 날씨 |
| **user_info / guide / news** | 프로필·행사·뉴스 |
| **Upstash REST** | POI L0, 스트림 gather 스냅샷 |
| **Redis TCP** | LangGraph 일정 체크포인트(옵션) |

---

## 9. 데이터 흐름(요약 다이어그램)

```mermaid
flowchart TB
  subgraph gather["gather_context"]
    P[프로필]
    F[행사]
    N[뉴스]
    W[날씨]
    P --- G1[asyncio.gather]
    F --- G1
    N --- G1
    W --- G1
    G1 --> L[언어 확정]
    L --> G2[asyncio.gather]
    WEB[웹 검색 LLM]
    KAK[카카오 POI 풀]
    WEB --- G2
    KAK --- G2
  end

  subgraph gen["generate_schedule"]
    D1[Day1 LLM]
    D2[Day2 LLM]
    Dn[DayN LLM]
    D1 --> D2 --> Dn
  end

  gather --> gen
  gen --> GEO[geocode 병렬]
  GEO --> ENR[영업시간 옵션]
```

---

## 10. 참고

- API·슬러그·캐시 키 상세: `md/planer-kroaddy-site.md`(있는 경우), 코드 기준은 `routes.py`
- 운영 이슈: `md/planer-standard-troubleshooting.md`
- 문서는 저장소 코드 변경에 맞춰 갱신할 것
