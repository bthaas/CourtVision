from __future__ import annotations

from dataclasses import dataclass

from .models import CaptureQuality, SessionState, ShotEvent, ShotResult, ZoneStats

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
    current_streak: int
    best_streak: int
    zone_breakdown: dict[str, ZoneStats]
    quality_flags: dict[str, int]


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


def serialize_zone_breakdown(zone_breakdown: dict[str, ZoneStats]) -> dict[str, dict[str, float | int]]:
    return {
        zone: {
            "attempts": stats.attempts,
            "makes": stats.makes,
            "percentage": stats.percentage,
        }
        for zone, stats in zone_breakdown.items()
    }


def summarize_quality_flags(events: list[ShotEvent]) -> dict[str, int]:
    quality = {"low_confidence": 0, "low_capture_quality": 0}
    for event in events:
        if event.confidence < 0.65:
            quality["low_confidence"] += 1
        if event.capture_quality in {CaptureQuality.LOW, CaptureQuality.UNUSABLE}:
            quality["low_capture_quality"] += 1
    return quality


def calculate_session_analytics(session: SessionState) -> SessionAnalytics:
    attempts = len(session.events)
    makes = sum(1 for event in session.events if event.result == ShotResult.MAKE)
    misses = attempts - makes
    fg_pct = round((makes / attempts) * 100, 1) if attempts else 0.0

    latencies = [event.inference_latency_ms for event in session.events]
    average_inference_latency_ms = round(sum(latencies) / len(latencies), 2) if latencies else 0.0

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
        current_streak=ending_streak,
        best_streak=best_streak,
        zone_breakdown=zone_breakdown,
        quality_flags=summarize_quality_flags(session.events),
    )


def serialize_event(payload: ShotEvent) -> dict[str, str | int | float | None]:
    return {
        "session_id": payload.session_id,
        "event_id": payload.event_id,
        "sequence": payload.sequence,
        "timestamp_ms": payload.timestamp_ms,
        "client_sent_at_ms": payload.client_sent_at_ms,
        "x_norm": payload.x_norm,
        "y_norm": payload.y_norm,
        "result": payload.result.value,
        "confidence": payload.confidence,
        "inference_latency_ms": payload.inference_latency_ms,
        "model_version": payload.model_version,
        "capture_quality": payload.capture_quality.value if payload.capture_quality is not None else None,
        "zone": get_zone(payload.x_norm, payload.y_norm),
    }
