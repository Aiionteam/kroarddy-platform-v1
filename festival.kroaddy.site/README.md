# Festival API (전국문화축제표준데이터)

공공데이터포털 **전국문화축제표준데이터** Open API를 호출해 행사 목록을 제공합니다.

## 환경변수

- `DATA_GO_KR_SERVICE_KEY`: 공공데이터포털 인증키 (sevices 루트 `.env`에 설정)

## 실행

**로컬 (권장, Docker DNS 오류 시):**

```bash
cd sevices.tourstory.site/festival
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

Windows: `run_local.bat` 더블클릭 또는 터미널에서 실행. (상위 `.env` 자동 로드)

**Docker:** `sevices.tourstory.site` 루트에서 `docker compose up`. 컨테이너에서 `api.data.go.kr` DNS가 안 되면 위처럼 로컬 실행.

## API

- `GET /api/v1/festivals?year=2026&month=2` — 해당 연·월 행사 목록 (name, place, startDate, endDate)
