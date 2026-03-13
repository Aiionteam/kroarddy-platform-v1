FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TORCH_HOME=/app/artifacts/models/torch_cache \
    HF_HOME=/app/artifacts/models/hf_cache \
    XDG_CACHE_HOME=/app/artifacts/models/xdg_cache

WORKDIR /app

# opencv/ultralytics 런타임 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 의존성 먼저 복사 (레이어 캐시 최적화)
COPY requirements.txt /app/requirements.txt

# Python dependencies
RUN python -m pip install --upgrade pip && \
    pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      torch==2.6.0+cpu torchvision==0.21.0+cpu \
      -r /app/requirements.txt

# 애플리케이션 소스 복사
COPY . /app

EXPOSE 8010 8011

# 기본 실행은 orchestrator (compose에서 override 가능)
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]






