from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from PIL import ExifTags, Image

from ..contracts import EvaluationRequest
from ..engine.workflow import run_photo_selection
from ..tourstar_autolog_pipeline import list_images
from .state import PhotoSelectionGraphState

_GPS_INFO_TAG = 34853


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
            headers={"User-Agent": "kroaddy-tourstar/1.0 (langgraph-gps-node)"},
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


def ingest_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    req = state.get("request")
    if req is None:
        req = EvaluationRequest()
    service_root = state.get("service_root") or Path(__file__).resolve().parents[5]

    explicit_image_paths = state.get("image_paths") or []
    input_dir = str(req.input_dir or (service_root / "artifacts" / "samples"))
    artifacts_dir = str(req.artifacts_dir or (service_root / "artifacts"))
    if explicit_image_paths:
        image_paths = [str(Path(p)) for p in explicit_image_paths]
    else:
        images = list_images(Path(input_dir))
        images = images[req.start_index :]
        if req.max_images is not None:
            images = images[: req.max_images]
        image_paths = [str(p) for p in images]

    return {
        **state,
        "request": req,
        "service_root": service_root,
        "input_dir": input_dir,
        "artifacts_dir": artifacts_dir,
        "image_paths": image_paths,
        "requested_at": state.get("requested_at") or datetime.now(),
        "gps_records": [],
        "location_candidates": [],
        "location_hint": "",
    }


def validate_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    image_paths = state.get("image_paths") or []
    if not image_paths:
        input_dir = Path(state["input_dir"])
        if not input_dir.exists():
            return {**state, "error": f"입력 폴더가 없습니다: {input_dir}"}
        return {**state, "error": f"평가할 이미지가 없습니다: {input_dir}"}
    return state


def extract_exif_gps_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    if state.get("error"):
        return state
    records: list[dict[str, Any]] = []
    for raw_path in state.get("image_paths") or []:
        path = Path(raw_path)
        if not path.exists() or not path.is_file():
            continue
        coords = _extract_gps_coordinates(path)
        if not coords:
            continue
        lat, lon = coords
        records.append({"path": str(path), "lat": lat, "lon": lon})
    return {**state, "gps_records": records}


def reverse_geocode_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    if state.get("error"):
        return state
    candidates: list[dict[str, Any]] = []
    for rec in state.get("gps_records") or []:
        lat = float(rec.get("lat", 0.0))
        lon = float(rec.get("lon", 0.0))
        place = _reverse_geocode(lat, lon)
        if not place:
            continue
        candidates.append(
            {
                "path": rec.get("path", ""),
                "lat": lat,
                "lon": lon,
                "place": place,
                "confidence": 1.0,
            }
        )
    return {**state, "location_candidates": candidates}


def select_location_hint_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    if state.get("error"):
        return state
    candidates = state.get("location_candidates") or []
    if not candidates:
        return {**state, "location_hint": ""}

    counter: dict[str, int] = {}
    for c in candidates:
        place = str(c.get("place", "")).strip()
        if not place:
            continue
        counter[place] = counter.get(place, 0) + 1
    if not counter:
        return {**state, "location_hint": ""}
    best_place = max(counter.items(), key=lambda x: x[1])[0]
    return {**state, "location_hint": best_place}


def evaluate_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    if state.get("error"):
        return state
    if state.get("metadata_only"):
        return state

    req = state["request"]
    result = run_photo_selection(
        req=req,
        service_root=state["service_root"],
        infer_func=state.get("infer_func"),
        job_id=state.get("job_id"),
        requested_at=state.get("requested_at"),
    )
    return {**state, "result": result}


def finalize_node(state: PhotoSelectionGraphState) -> PhotoSelectionGraphState:
    # 후속 확장을 위한 종결 노드(메트릭/로그/후처리 삽입 지점)
    return state


def has_gps_records(state: PhotoSelectionGraphState) -> str:
    return "reverse_geocode" if bool(state.get("gps_records")) else "evaluate_or_end"


def evaluate_or_end(state: PhotoSelectionGraphState) -> str:
    return "end" if state.get("metadata_only") else "evaluate"

