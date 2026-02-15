from __future__ import annotations

from dataclasses import dataclass

from .models import SessionState, ShotEvent, ShotResult, ZoneStats

ZONE_NAMES = [
    "left_corner_3",
    "left_wing_3",
    "top_key_3",
    "right_wing_3",
    "right_corner_3",
    "left_midrange",
    "center_paint",
    "right_midrange",
]


@dataclass(slots=True)
class SessionAnalytics:
    attempts: int
    makes: int
    misses: int
    fg_pct: float
    average_inference_latency_ms: float
    average_form_score: float
    current_streak: int
    best_streak: int
    zone_breakdown: dict[str, ZoneStats]


def get_zone(x_norm: float, y_norm: float) -> str:
    # 0..1 coordinate system where y=0 is baseline and y=1 is far court.
    if y_norm < 0.18:
        if x_norm < 0.2:
            return "left_corner_3"
        if x_norm > 0.8:
            return "right_corner_3"
    if y_norm < 0.36:
        if x_norm < 0.35:
            return "left_midrange"
        if x_norm > 0.65:
            return "right_midrange"
        return "center_paint"
    if x_norm < 0.25:
        return "left_wing_3"
    if x_norm > 0.75:
        return "right_wing_3"
    return "top_key_3"


def build_zone_buckets() -> dict[str, ZoneStats]:
    return {name: ZoneStats() for name in ZONE_NAMES}


def calculate_session_analytics(session: SessionState) -> SessionAnalytics:
    attempts = len(session.events)
    makes = sum(1 for event in session.events if event.result == ShotResult.MAKE)
    misses = attempts - makes
    fg_pct = round((makes / attempts) * 100, 1) if attempts else 0.0

    latencies = [event.inference_latency_ms for event in session.events]
    average_inference_latency_ms = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
    form_scores = [calculate_form_score(event) for event in session.events]
    average_form_score = round(sum(form_scores) / len(form_scores), 1) if form_scores else 0.0

    current_streak = 0
    best_streak = 0
    for event in session.events:
        if event.result == ShotResult.MAKE:
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        else:
            current_streak = 0

    # Recompute ending streak for display.
    ending_streak = 0
    for event in reversed(session.events):
        if event.result == ShotResult.MAKE:
            ending_streak += 1
        else:
            break

    zone_breakdown = build_zone_buckets()
    for event in session.events:
        zone = get_zone(event.x_norm, event.y_norm)
        zone_entry = zone_breakdown[zone]
        zone_entry.attempts += 1
        if event.result == ShotResult.MAKE:
            zone_entry.makes += 1

    return SessionAnalytics(
        attempts=attempts,
        makes=makes,
        misses=misses,
        fg_pct=fg_pct,
        average_inference_latency_ms=average_inference_latency_ms,
        average_form_score=average_form_score,
        current_streak=ending_streak,
        best_streak=best_streak,
        zone_breakdown=zone_breakdown,
    )


def _score_angle(value: float | None, target: float, tolerance: float) -> float:
    if value is None:
        return 0.0
    delta = abs(value - target)
    if delta >= tolerance:
        return 0.0
    return (1 - (delta / tolerance)) * 100


def calculate_form_score(payload: ShotEvent) -> float:
    # Lightweight form proxy from estimated joint angles.
    elbow_score = _score_angle(payload.elbow_angle_deg, target=92.0, tolerance=35.0)
    knee_score = _score_angle(payload.knee_angle_deg, target=115.0, tolerance=45.0)
    torso_score = _score_angle(payload.torso_tilt_deg, target=11.0, tolerance=18.0)

    blended = (elbow_score * 0.45) + (knee_score * 0.35) + (torso_score * 0.2)
    return round(blended, 1)


def serialize_event(payload: ShotEvent) -> dict[str, str | int | float | None]:
    return {
        "session_id": payload.session_id,
        "timestamp_ms": payload.timestamp_ms,
        "x_norm": payload.x_norm,
        "y_norm": payload.y_norm,
        "result": payload.result.value,
        "confidence": payload.confidence,
        "inference_latency_ms": payload.inference_latency_ms,
        "release_angle_deg": payload.release_angle_deg,
        "elbow_angle_deg": payload.elbow_angle_deg,
        "knee_angle_deg": payload.knee_angle_deg,
        "torso_tilt_deg": payload.torso_tilt_deg,
        "form_score": calculate_form_score(payload),
        "zone": get_zone(payload.x_norm, payload.y_norm),
    }
