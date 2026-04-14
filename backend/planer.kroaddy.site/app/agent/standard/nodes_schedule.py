"""Compatibility facade for standard schedule modules.

Star topology:
- hub: `schedule_orchestrator`
- spokes: `schedule_context`, `schedule_daygen`, `schedule_geocode`
"""

from app.agent.standard.schedule_context import (  # noqa: F401
    _format_naver_tips_block,
    _format_web_search_block,
    _gather_kakao_poi_pool_block,
    _gather_naver_tips_context,
    _gather_web_search_context,
    gather_context_node,
)
from app.agent.standard.schedule_daygen import (  # noqa: F401
    _SingleDayCommonKwargs,
    _banned_experience_block,
    _experience_tags_for_items,
    _fix_duplicate_days,
    _generate_single_day,
    _validate_full_trip_schedule,
    _venue_dedupe_key,
)
from app.agent.standard.schedule_geocode import _geocode_item, geocode_schedule  # noqa: F401
from app.agent.standard.schedule_orchestrator import (  # noqa: F401
    _build_date_list,
    _build_festival_block,
    enrich_business_hours_schedule,
    generate_schedule,
)
