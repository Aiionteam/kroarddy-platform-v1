from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from threading import Lock

from ..contracts import EvaluationResult, JobStatusResponse


class JobStore:
    """간단한 메모리+파일 기반 작업 상태 저장소."""

    def __init__(self, snapshot_path: Path | None = None) -> None:
        self._lock = Lock()
        self._jobs: dict[str, JobStatusResponse] = {}
        self._idempotency_map: dict[str, str] = {}
        self._snapshot_path = snapshot_path
        if snapshot_path is not None:
            self._load_snapshot(snapshot_path)

    def get(self, job_id: str) -> JobStatusResponse | None:
        with self._lock:
            return self._jobs.get(job_id)

    def get_by_idempotency_key(self, key: str) -> JobStatusResponse | None:
        with self._lock:
            job_id = self._idempotency_map.get(key)
            return self._jobs.get(job_id) if job_id else None

    def put(self, job: JobStatusResponse, idempotency_key: str | None = None) -> None:
        with self._lock:
            self._jobs[job.job_id] = job
            if idempotency_key:
                self._idempotency_map[idempotency_key] = job.job_id
            self._save_snapshot()

    def mark_running(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "running"
            self._save_snapshot()

    def mark_retry(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "queued"
            job.error = error
            self._save_snapshot()

    def mark_completed(self, job_id: str, completed_at: datetime, result: EvaluationResult) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "completed"
            job.completed_at = completed_at
            job.result = result
            job.error = None
            self._save_snapshot()

    def mark_failed(self, job_id: str, completed_at: datetime, error: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "failed"
            job.completed_at = completed_at
            job.error = error
            self._save_snapshot()

    def increment_attempts(self, job_id: str) -> int:
        with self._lock:
            job = self._jobs[job_id]
            job.attempts += 1
            self._save_snapshot()
            return job.attempts

    def _load_snapshot(self, path: Path) -> None:
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            jobs = data.get("jobs", {})
            idemp = data.get("idempotency_map", {})
            for job_id, payload in jobs.items():
                self._jobs[job_id] = JobStatusResponse.model_validate(payload)
            self._idempotency_map = {str(k): str(v) for k, v in idemp.items()}
        except Exception:
            # 스냅샷 오류가 있어도 서비스 시작은 진행한다.
            self._jobs = {}
            self._idempotency_map = {}

    def _save_snapshot(self) -> None:
        if self._snapshot_path is None:
            return
        self._snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "jobs": {job_id: job.model_dump(mode="json") for job_id, job in self._jobs.items()},
            "idempotency_map": self._idempotency_map,
        }
        self._snapshot_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


