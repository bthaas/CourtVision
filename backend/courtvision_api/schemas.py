from __future__ import annotations

from pydantic import BaseModel, Field

from .models import ShotResult


class StartSessionRequest(BaseModel):
    athlete_id: str = Field(min_length=1, max_length=80)


class StartSessionResponse(BaseModel):
    session_id: str


class ShotEventPayload(BaseModel):
    session_id: str
    timestamp_ms: int = Field(ge=0)
    x_norm: float = Field(ge=0.0, le=1.0)
    y_norm: float = Field(ge=0.0, le=1.0)
    result: ShotResult
    confidence: float = Field(ge=0.0, le=1.0)
    inference_latency_ms: float = Field(ge=0.0)
    release_angle_deg: float | None = None
    elbow_angle_deg: float | None = None
    knee_angle_deg: float | None = None
    torso_tilt_deg: float | None = None


class SessionSummaryResponse(BaseModel):
    session_id: str
    attempts: int
    makes: int
    misses: int
    fg_pct: float
    average_inference_latency_ms: float
    average_form_score: float
    current_streak: int
    best_streak: int
    zone_breakdown: dict[str, dict[str, float | int]]
