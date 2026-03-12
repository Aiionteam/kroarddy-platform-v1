FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# opencv/ultralytics 런타임 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 패키지 소스 복사
COPY . /app

# Python dependencies
RUN python -m pip install --upgrade pip && \
    pip install -r /app/requirements.txt && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

EXPOSE 8010 8011

# 기본 실행은 orchestrator (compose에서 override 가능)
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]






