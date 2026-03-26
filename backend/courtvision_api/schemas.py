from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .models import CaptureQuality, ShotResult


class CourtVisionSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class DevLoginRequest(CourtVisionSchema):
    display_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=160)


class UserResponse(CourtVisionSchema):
    user_id: str
    email: str
    display_name: str
    roles: list[str]
    access_token: str | None = None
    token_expires_at: datetime | None = None


class AthleteCreateRequest(CourtVisionSchema):
    display_name: str = Field(min_length=1, max_length=80)


class AthleteResponse(CourtVisionSchema):
    athlete_id: str
    owner_user_id: str
    display_name: str
    created_at: datetime


class StartSessionRequest(CourtVisionSchema):
    athlete_id: str = Field(min_length=1, max_length=80)
    device_info: dict[str, Any] | None = None
    model_version: str | None = Field(default=None, max_length=120)


class StartSessionResponse(CourtVisionSchema):
    session_id: str
    athlete_id: str
    athlete_display_name: str
    publish_token: str
    view_token: str
    viewer_share_url: str
    token_expires_at: datetime
    model_version: str | None = None


class ShareCreateRequest(CourtVisionSchema):
    label: str = Field(default="Live viewer", min_length=1, max_length=80)
    expires_in_hours: int = Field(default=72, ge=1, le=24 * 14)


class ShareResponse(CourtVisionSchema):
    share_id: str
    session_id: str
    label: str
    viewer_share_url: str
    expires_at: datetime | None
    revoked_at: datetime | None = None
    created_at: datetime


class ShotEventPayload(CourtVisionSchema):
    session_id: str
    event_id: str = Field(min_length=1, max_length=120)
    sequence: int = Field(ge=0)
    timestamp_ms: int = Field(ge=0)
    client_sent_at_ms: int | None = Field(default=None, ge=0)
    x_norm: float = Field(ge=0.0, le=1.0)
    y_norm: float = Field(ge=0.0, le=1.0)
    result: ShotResult
    confidence: float = Field(ge=0.0, le=1.0)
    inference_latency_ms: float = Field(ge=0.0)
    model_version: str | None = Field(default=None, max_length=120)
    capture_quality: CaptureQuality | None = None


class SessionShotResponse(CourtVisionSchema):
    session_id: str
    event_id: str
    sequence: int
    timestamp_ms: int
    client_sent_at_ms: int | None = None
    x_norm: float
    y_norm: float
    result: ShotResult
    confidence: float
    inference_latency_ms: float
    model_version: str | None = None
    capture_quality: CaptureQuality | None = None
    zone: str


class SessionSummaryResponse(CourtVisionSchema):
    session_id: str
    athlete_id: str
    athlete_display_name: str
    started_at: datetime
    attempts: int
    makes: int
    misses: int
    fg_pct: float
    average_inference_latency_ms: float
    current_streak: int
    best_streak: int
    model_version: str | None = None
    quality_flags: dict[str, int]
    zone_breakdown: dict[str, dict[str, float | int]]
    shots: list[SessionShotResponse]


class SessionListItemResponse(CourtVisionSchema):
    session_id: str
    athlete_id: str
    athlete_display_name: str
    started_at: datetime
    attempts: int
    makes: int
    misses: int
    fg_pct: float
    model_version: str | None = None


class SessionDetailResponse(SessionSummaryResponse):
    share_links: list[ShareResponse]
