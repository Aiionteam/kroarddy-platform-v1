# Tour planner API - 날씨 / user-content (NSFW 필터 포함)
FROM python:3.11-slim

WORKDIR /app

# libgomp: onnxruntime 의존 (nudenet ONNX 모델 실행에 필요)
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# NudeNet ONNX 모델 빌드 타임에 미리 다운로드
# (~550 MB, 런타임 첫 요청 시 다운로드 대기 방지)
RUN python -c "from nudenet import NudeDetector; NudeDetector()" || true

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

ENV PORT=8003
EXPOSE 8003

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8003"]
