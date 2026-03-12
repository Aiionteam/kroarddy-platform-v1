from __future__ import annotations

from pathlib import Path

from .agent.photo_selection_agent import PhotoSelectionAgent
from .workers.job_store import JobStore
from .workers.job_worker import JobWorker


service_root = Path(__file__).resolve().parents[3]
agent = PhotoSelectionAgent(service_root=service_root)
store = JobStore(snapshot_path=service_root / "artifacts" / "config" / "jobs_state.json")
worker = JobWorker(store=store, agent=agent, concurrency=1)


