from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class ShotResult(str, Enum):
    MAKE = "make"
    MISS = "miss"


class CaptureQuality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNUSABLE = "unusable"


@dataclass(slots=True)
class UserProfile:
    user_id: str
    email: str
    display_name: str
    roles: tuple[str, ...] = ("athlete",)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class AthleteProfile:
    athlete_id: str
    owner_user_id: str
    display_name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class ShareLink:
    share_id: str
    session_id: str
    owner_user_id: str
    label: str
    token: str
    expires_at: datetime | None
    revoked_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class ShotEvent:
    session_id: str
    timestamp_ms: int
    x_norm: float
    y_norm: float
    result: ShotResult
    confidence: float
    inference_latency_ms: float
    event_id: str = ""
    sequence: int = 0
    client_sent_at_ms: int | None = None
    model_version: str | None = None
    capture_quality: CaptureQuality | None = None
    pose_detected: bool = False
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
    owner_user_id: str = "legacy-demo"
    athlete_display_name: str = ""
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    model_version: str | None = None
    device_info: dict[str, Any] = field(default_factory=dict)
    events: list[ShotEvent] = field(default_factory=list)
    share_links: list[ShareLink] = field(default_factory=list)
