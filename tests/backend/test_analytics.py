from courtvision_api.analytics import calculate_session_analytics, get_zone
from courtvision_api.models import SessionState, ShotEvent, ShotResult


def make_event(x: float, y: float, result: ShotResult, latency: float) -> ShotEvent:
    return ShotEvent(
        session_id="session-1",
        timestamp_ms=1,
        x_norm=x,
        y_norm=y,
        result=result,
        confidence=0.95,
        inference_latency_ms=latency,
    )


def test_get_zone_coverage() -> None:
    assert get_zone(0.1, 0.1) == "left_corner_3"
    assert get_zone(0.9, 0.1) == "right_corner_3"
    assert get_zone(0.5, 0.3) == "center_paint"
    assert get_zone(0.5, 0.8) == "top_key_3"


def test_calculate_session_analytics() -> None:
    session = SessionState(session_id="session-1", athlete_id="athlete-1")
    session.events = [
        make_event(0.1, 0.1, ShotResult.MAKE, 150),
        make_event(0.5, 0.7, ShotResult.MAKE, 200),
        make_event(0.7, 0.2, ShotResult.MISS, 180),
        make_event(0.85, 0.1, ShotResult.MAKE, 170),
    ]

    analytics = calculate_session_analytics(session)

    assert analytics.attempts == 4
    assert analytics.makes == 3
    assert analytics.misses == 1
    assert analytics.fg_pct == 75.0
    assert analytics.best_streak == 2
    assert analytics.current_streak == 1
    assert analytics.average_inference_latency_ms == 175.0
    assert analytics.zone_breakdown["left_corner_3"].makes == 1
    assert analytics.zone_breakdown["right_corner_3"].makes == 1
