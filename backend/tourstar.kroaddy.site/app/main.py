from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.v1.photo_selection_router import router as photo_selection_router
from .domain.v1.state import worker

_ROOT = Path(__file__).resolve().parents[2]
_env = _ROOT / ".env"
if _env.exists():
    from dotenv import load_dotenv

    load_dotenv(_env)


app = FastAPI(title="Tourstar Photo Selection Agent", version="0.1.0")
app.include_router(photo_selection_router, prefix="/v1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service_root = Path(__file__).resolve().parents[1]
uploads_root = service_root / "artifacts"
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/tourstar-files", StaticFiles(directory=str(uploads_root)), name="tourstar-files")


@app.on_event("startup")
def _startup() -> None:
    worker.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    worker.stop()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "worker": "running"}


