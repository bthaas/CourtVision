from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class ShotResult(str, Enum):
    MAKE = "make"
    MISS = "miss"


@dataclass(slots=True)
class ShotEvent:
    session_id: str
    timestamp_ms: int
    x_norm: float
    y_norm: float
    result: ShotResult
    confidence: float
    inference_latency_ms: float
    release_angle_deg: float | None = None
    elbow_angle_deg: float | None = None
    knee_angle_deg: float | None = None
    torso_tilt_deg: float | None = None


@dataclass(slots=True)
class ZoneStats:
    attempts: int = 0
    makes: int = 0

    @property
    def percentage(self) -> float:
        if self.attempts == 0:
            return 0.0
        return round((self.makes / self.attempts) * 100, 1)


@dataclass(slots=True)
class SessionState:
    session_id: str
    athlete_id: str
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    events: list[ShotEvent] = field(default_factory=list)
