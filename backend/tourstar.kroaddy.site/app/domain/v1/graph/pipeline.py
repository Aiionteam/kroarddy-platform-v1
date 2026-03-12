from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from .nodes import (
    evaluate_node,
    evaluate_or_end,
    extract_exif_gps_node,
    finalize_node,
    has_gps_records,
    ingest_node,
    reverse_geocode_node,
    select_location_hint_node,
    validate_node,
)
from .state import PhotoSelectionGraphState


@lru_cache(maxsize=1)
def build_photo_selection_graph():
    builder = StateGraph(PhotoSelectionGraphState)
    builder.add_node("ingest", ingest_node)
    builder.add_node("validate", validate_node)
    builder.add_node("extract_exif_gps", extract_exif_gps_node)
    builder.add_node("reverse_geocode", reverse_geocode_node)
    builder.add_node("select_location_hint", select_location_hint_node)
    builder.add_node("evaluate", evaluate_node)
    builder.add_node("finalize", finalize_node)

    builder.add_edge(START, "ingest")
    builder.add_edge("ingest", "validate")
    builder.add_edge("validate", "extract_exif_gps")
    builder.add_conditional_edges(
        "extract_exif_gps",
        has_gps_records,
        {
            "reverse_geocode": "reverse_geocode",
            "evaluate_or_end": "evaluate",
        },
    )
    builder.add_edge("reverse_geocode", "select_location_hint")
    builder.add_conditional_edges(
        "select_location_hint",
        evaluate_or_end,
        {
            "evaluate": "evaluate",
            "end": END,
        },
    )
    builder.add_edge("evaluate", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


@lru_cache(maxsize=1)
def build_metadata_graph():
    builder = StateGraph(PhotoSelectionGraphState)
    builder.add_node("ingest", ingest_node)
    builder.add_node("validate", validate_node)
    builder.add_node("extract_exif_gps", extract_exif_gps_node)
    builder.add_node("reverse_geocode", reverse_geocode_node)
    builder.add_node("select_location_hint", select_location_hint_node)

    builder.add_edge(START, "ingest")
    builder.add_edge("ingest", "validate")
    builder.add_edge("validate", "extract_exif_gps")
    builder.add_conditional_edges(
        "extract_exif_gps",
        has_gps_records,
        {
            "reverse_geocode": "reverse_geocode",
            "evaluate_or_end": END,
        },
    )
    builder.add_edge("reverse_geocode", "select_location_hint")
    builder.add_edge("select_location_hint", END)
    return builder.compile()

