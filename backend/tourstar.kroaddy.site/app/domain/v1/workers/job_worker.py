from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from queue import Empty, Queue
from threading import Event, Thread
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from ..agent.photo_selection_agent import PhotoSelectionAgent
from ..contracts import EvaluationRequest, EvaluationResult
from .job_store import JobStore


@dataclass(slots=True)
class QueueJob:
    job_id: str
    request: EvaluationRequest


class JobWorker:
    """큐 기반 비동기 워커(재시도/타임아웃 포함)."""

    def __init__(self, store: JobStore, agent: PhotoSelectionAgent, concurrency: int = 1) -> None:
        self._store = store
        self._agent = agent
        self._queue: Queue[QueueJob] = Queue()
        self._stop = Event()
        self._threads: list[Thread] = []
        self._concurrency = max(1, concurrency)

    def start(self) -> None:
        if self._threads:
            return
        self._stop.clear()
        for idx in range(self._concurrency):
            t = Thread(target=self._run, name=f"tourstar-worker-{idx+1}", daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self) -> None:
        self._stop.set()
        for _ in self._threads:
            self._queue.put(QueueJob(job_id="", request=EvaluationRequest()))
        for t in self._threads:
            t.join(timeout=2.0)
        self._threads.clear()

    def enqueue(self, job_id: str, request: EvaluationRequest) -> None:
        self._queue.put(QueueJob(job_id=job_id, request=request))

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                item = self._queue.get(timeout=0.3)
            except Empty:
                continue

            if not item.job_id:
                self._queue.task_done()
                continue

            current = self._store.get(item.job_id)
            if current is None:
                self._queue.task_done()
                continue

            attempts = self._store.increment_attempts(item.job_id)
            self._store.mark_running(item.job_id)
            try:
                result = self._evaluate_with_timeout(item.job_id, current.requested_at, item.request)
                self._store.mark_completed(item.job_id, datetime.now(), result)
            except Exception as exc:  # noqa: BLE001
                can_retry = attempts <= item.request.max_retries
                if can_retry:
                    self._store.mark_retry(item.job_id, str(exc))
                    self._queue.put(item)
                else:
                    self._store.mark_failed(item.job_id, datetime.now(), str(exc))
            finally:
                self._queue.task_done()

    def _evaluate_with_timeout(
        self,
        job_id: str,
        requested_at: datetime,
        request: EvaluationRequest,
    ) -> EvaluationResult:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._agent.evaluate, request, job_id, requested_at)
            try:
                return future.result(timeout=request.timeout_seconds)
            except FutureTimeoutError as exc:
                raise TimeoutError(f"Job timeout after {request.timeout_seconds}s") from exc


