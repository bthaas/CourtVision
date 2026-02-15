from __future__ import annotations

import os
import uuid

from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room
from pydantic import ValidationError

from .analytics import calculate_session_analytics, serialize_event
from .models import SessionState, ShotEvent
from .schemas import SessionSummaryResponse, ShotEventPayload, StartSessionRequest, StartSessionResponse
from .store import SessionStore


def create_app() -> tuple[Flask, SocketIO, SessionStore]:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "courtvision-dev"
    async_mode = os.getenv("CV_SOCKET_ASYNC_MODE", "threading")
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)
    store = SessionStore()

    @app.get("/health")
    def health() -> tuple[dict[str, str], int]:
        return {"status": "ok"}, 200

    @app.post("/api/sessions")
    def start_session() -> tuple[dict[str, str], int]:
        try:
            payload = StartSessionRequest.model_validate(request.get_json(force=True, silent=False))
        except ValidationError as exc:
            return {"error": exc.errors()}, 422

        session_id = str(uuid.uuid4())
        store.create(SessionState(session_id=session_id, athlete_id=payload.athlete_id))
        return StartSessionResponse(session_id=session_id).model_dump(), 201

    @app.get("/api/sessions/<session_id>/summary")
    def summary(session_id: str) -> tuple[dict[str, object], int]:
        session = store.get(session_id)
        if session is None:
            return {"error": "session not found"}, 404

        analytics = calculate_session_analytics(session)
        zone_breakdown = {
            zone: {
                "attempts": stats.attempts,
                "makes": stats.makes,
                "percentage": stats.percentage,
            }
            for zone, stats in analytics.zone_breakdown.items()
        }

        response = SessionSummaryResponse(
            session_id=session_id,
            attempts=analytics.attempts,
            makes=analytics.makes,
            misses=analytics.misses,
            fg_pct=analytics.fg_pct,
            average_inference_latency_ms=analytics.average_inference_latency_ms,
            average_form_score=analytics.average_form_score,
            current_streak=analytics.current_streak,
            best_streak=analytics.best_streak,
            zone_breakdown=zone_breakdown,
        )
        return response.model_dump(), 200

    @socketio.on("join_session")
    def handle_join_session(data: dict[str, str]) -> None:
        session_id = data.get("session_id")
        if not session_id or store.get(session_id) is None:
            emit("error", {"message": "invalid session_id"})
            return

        join_room(session_id)
        emit("session_joined", {"session_id": session_id})

    @socketio.on("shot_event")
    def handle_shot_event(data: dict[str, object]) -> None:
        try:
            payload = ShotEventPayload.model_validate(data)
        except ValidationError as exc:
            emit("error", {"message": "invalid shot event", "details": exc.errors()})
            return

        session = store.get(payload.session_id)
        if session is None:
            emit("error", {"message": "session not found"})
            return

        event = ShotEvent(
            session_id=payload.session_id,
            timestamp_ms=payload.timestamp_ms,
            x_norm=payload.x_norm,
            y_norm=payload.y_norm,
            result=payload.result,
            confidence=payload.confidence,
            inference_latency_ms=payload.inference_latency_ms,
            release_angle_deg=payload.release_angle_deg,
            elbow_angle_deg=payload.elbow_angle_deg,
            knee_angle_deg=payload.knee_angle_deg,
            torso_tilt_deg=payload.torso_tilt_deg,
        )
        session.events.append(event)

        analytics = calculate_session_analytics(session)
        payload_dict = serialize_event(event)
        payload_dict["session_stats"] = {
            "attempts": analytics.attempts,
            "makes": analytics.makes,
            "misses": analytics.misses,
            "fg_pct": analytics.fg_pct,
            "avg_latency": analytics.average_inference_latency_ms,
            "avg_form_score": analytics.average_form_score,
            "current_streak": analytics.current_streak,
            "best_streak": analytics.best_streak,
        }

        socketio.emit("shot_event", payload_dict, room=payload.session_id)

    return app, socketio, store


app, socketio, _store = create_app()


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
