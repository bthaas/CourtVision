from __future__ import annotations

import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, Response, g, request
from flask_socketio import SocketIO, emit, join_room
from pydantic import ValidationError
from werkzeug.exceptions import BadRequest

from .analytics import calculate_session_analytics, serialize_event, serialize_zone_breakdown
from .auth import (
    SESSION_GRANT_OWNER,
    SESSION_GRANT_SHARE,
    SESSION_SCOPE_PUBLISH,
    SESSION_SCOPE_VIEW,
    SessionGrant,
    SessionTokenError,
    SessionTokenManager,
    UserTokenError,
    UserTokenManager,
)
from .models import AthleteProfile, SessionState, ShareLink, ShotEvent, UserProfile
from .schemas import (
    AthleteCreateRequest,
    AthleteResponse,
    DevLoginRequest,
    SessionDetailResponse,
    SessionListItemResponse,
    SessionSummaryResponse,
    ShareCreateRequest,
    ShareResponse,
    ShotEventPayload,
    StartSessionRequest,
    StartSessionResponse,
    UserResponse,
)
from .store import SessionStore


def _get_bearer_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.removeprefix("Bearer ").strip() or None
    return None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FixedWindowRateLimiter:
    def __init__(self) -> None:
        self._windows: dict[str, tuple[float, int]] = {}

    def allow(self, key: str, *, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        window_started_at, count = self._windows.get(key, (now, 0))
        if now - window_started_at >= window_seconds:
            self._windows[key] = (now, 1)
            return True
        if count >= limit:
            return False
        self._windows[key] = (window_started_at, count + 1)
        return True


def _default_allowed_origins() -> list[str]:
    configured = os.getenv("CV_CORS_ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "exp://127.0.0.1:8081",
        "exp://localhost:8081",
    ]


def _build_share_url(base_url: str, session_id: str, token: str) -> str:
    return f"{base_url.rstrip('/')}/?sessionId={session_id}&token={token}"


def create_app(
    *,
    db_path: str | None = None,
    secret_key: str | None = None,
    token_secret: str | None = None,
    token_max_age_seconds: int | None = None,
    public_base_url: str | None = None,
) -> tuple[Flask, SocketIO, SessionStore]:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = secret_key or os.getenv("CV_SECRET_KEY", "courtvision-dev")
    async_mode = os.getenv("CV_SOCKET_ASYNC_MODE", "threading")
    allowed_origins = _default_allowed_origins()
    socketio = SocketIO(app, cors_allowed_origins=allowed_origins, async_mode=async_mode)
    default_db_path = str(Path(__file__).resolve().parents[1] / "courtvision.db")
    store = SessionStore(db_path or os.getenv("CV_DB_PATH", default_db_path))
    session_token_manager = SessionTokenManager(
        token_secret or os.getenv("CV_SESSION_TOKEN_SECRET", app.config["SECRET_KEY"]),
        token_max_age_seconds or int(os.getenv("CV_SESSION_TOKEN_MAX_AGE_SECONDS", "604800")),
    )
    user_token_manager = UserTokenManager(
        os.getenv("CV_USER_TOKEN_SECRET", app.config["SECRET_KEY"]),
        int(os.getenv("CV_USER_TOKEN_MAX_AGE_SECONDS", "604800")),
    )
    enable_dev_auth = os.getenv("CV_ENABLE_DEV_AUTH", "1") != "0"
    app_public_base_url = public_base_url or os.getenv("CV_PUBLIC_BASE_URL", "http://localhost:5173")
    limiter = FixedWindowRateLimiter()
    logger = logging.getLogger("courtvision.api")

    def json_error(message: str, status_code: int, *, details: object | None = None) -> tuple[dict[str, object], int]:
        payload: dict[str, object] = {"error": message}
        if details is not None:
            payload["details"] = details
        return payload, status_code

    def require_rate_limit(key: str, *, limit: int, window_seconds: int) -> tuple[dict[str, object], int] | None:
        if limiter.allow(key, limit=limit, window_seconds=window_seconds):
            return None
        return json_error("rate limit exceeded", 429)

    def build_share_response(share: ShareLink) -> ShareResponse:
        return ShareResponse(
            share_id=share.share_id,
            session_id=share.session_id,
            label=share.label,
            viewer_share_url=_build_share_url(app_public_base_url, share.session_id, share.token),
            expires_at=share.expires_at,
            revoked_at=share.revoked_at,
            created_at=share.created_at,
        )

    def build_summary_response(session: SessionState) -> SessionSummaryResponse:
        analytics = calculate_session_analytics(session)
        return SessionSummaryResponse(
            session_id=session.session_id,
            athlete_id=session.athlete_id,
            athlete_display_name=session.athlete_display_name,
            started_at=session.started_at,
            attempts=analytics.attempts,
            makes=analytics.makes,
            misses=analytics.misses,
            fg_pct=analytics.fg_pct,
            average_inference_latency_ms=analytics.average_inference_latency_ms,
            current_streak=analytics.current_streak,
            best_streak=analytics.best_streak,
            model_version=session.model_version,
            quality_flags=analytics.quality_flags,
            zone_breakdown=serialize_zone_breakdown(analytics.zone_breakdown),
            shots=[serialize_event(event) for event in session.events],
        )

    def build_list_item(session: SessionState) -> SessionListItemResponse:
        analytics = calculate_session_analytics(session)
        return SessionListItemResponse(
            session_id=session.session_id,
            athlete_id=session.athlete_id,
            athlete_display_name=session.athlete_display_name,
            started_at=session.started_at,
            attempts=analytics.attempts,
            makes=analytics.makes,
            misses=analytics.misses,
            fg_pct=analytics.fg_pct,
            model_version=session.model_version,
        )

    def create_share(session_id: str, owner_user_id: str, label: str, *, expires_in_hours: int = 72) -> ShareLink:
        share_id = str(uuid.uuid4())
        token = session_token_manager.mint_share(session_id, share_id)
        share = ShareLink(
            share_id=share_id,
            session_id=session_id,
            owner_user_id=owner_user_id,
            label=label,
            token=token,
            expires_at=_utcnow() + timedelta(hours=expires_in_hours),
        )
        store.create_share(share)
        return share

    def require_user() -> tuple[UserProfile | None, tuple[dict[str, object], int] | None]:
        token = _get_bearer_token()
        if not token:
            return None, json_error("missing bearer token", 401)

        try:
            user = user_token_manager.verify(token)
        except UserTokenError as exc:
            status_code = 401 if "expired" in str(exc) else 403
            return None, json_error(str(exc), status_code)

        store.upsert_user(user)
        return user, None

    def authorize_session_token(session_id: str, token: str | None, allowed_scopes: set[str]) -> SessionGrant:
        if not token:
            raise SessionTokenError("missing session token")

        grant = session_token_manager.verify(token, session_id=session_id, allowed_scopes=allowed_scopes)
        if grant.grant_kind == SESSION_GRANT_OWNER:
            if not grant.owner_user_id or not store.session_owned_by(session_id, grant.owner_user_id):
                raise SessionTokenError("session token owner no longer has access")
            return grant

        if grant.grant_kind == SESSION_GRANT_SHARE:
            if not grant.share_id:
                raise SessionTokenError("invalid session token")
            share = store.get_share(grant.share_id)
            if share is None or share.session_id != session_id or share.token != token:
                raise SessionTokenError("share access revoked")
            if share.revoked_at is not None:
                raise SessionTokenError("share access revoked")
            if share.expires_at is not None and share.expires_at <= _utcnow():
                raise SessionTokenError("share access expired")
            return grant

        raise SessionTokenError("invalid session token")

    def authorize_summary_request(session_id: str) -> tuple[tuple[dict[str, object], int] | None, SessionState | None]:
        session = store.get(session_id)
        if session is None:
            return json_error("session not found", 404), None

        token = _get_bearer_token()
        if not token:
            return json_error("missing session token", 401), None

        try:
            user = user_token_manager.verify(token)
        except UserTokenError:
            user = None

        if user is not None:
            store.upsert_user(user)
            if not store.session_owned_by(session_id, user.user_id):
                return json_error("forbidden", 403), None
            return None, session

        try:
            authorize_session_token(session_id, token, {SESSION_SCOPE_VIEW, SESSION_SCOPE_PUBLISH})
        except SessionTokenError as exc:
            status_code = 401 if "missing" in str(exc) else 403
            return json_error(str(exc), status_code), None
        return None, session

    @app.before_request
    def before_request() -> Response | None:
        g.request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        if request.method == "OPTIONS":
            return Response(status=204)
        return None

    @app.after_request
    def after_request(response: Response) -> Response:
        response.headers["X-Request-Id"] = g.get("request_id", uuid.uuid4().hex)
        origin = request.headers.get("Origin")
        if origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Request-Id"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
            response.headers["Vary"] = "Origin"
        logger.info(
            json.dumps(
                {
                    "request_id": g.get("request_id"),
                    "method": request.method,
                    "path": request.path,
                    "status_code": response.status_code,
                    "remote_addr": request.remote_addr,
                }
            )
        )
        return response

    @app.errorhandler(BadRequest)
    def handle_bad_request(_exc: BadRequest) -> tuple[dict[str, object], int]:
        return json_error("invalid request body", 400)

    @app.get("/health")
    def health() -> tuple[dict[str, str], int]:
        return {"status": "ok"}, 200

    @app.get("/ready")
    def ready() -> tuple[dict[str, str], int]:
        try:
            store.ping()
        except Exception:
            return {"status": "not_ready"}, 503
        return {"status": "ready"}, 200

    @app.post("/api/dev/login")
    def dev_login() -> tuple[dict[str, object], int]:
        if not enable_dev_auth:
            return json_error("dev auth is disabled", 404)

        rate_limited = require_rate_limit(f"dev-login:{request.remote_addr}", limit=20, window_seconds=60)
        if rate_limited is not None:
            return rate_limited

        try:
            payload = DevLoginRequest.model_validate(request.get_json(force=True, silent=False))
        except ValidationError as exc:
            return json_error("invalid login payload", 422, details=exc.errors())

        user = UserProfile(
            user_id=uuid.uuid5(uuid.NAMESPACE_DNS, payload.email.lower()).hex,
            email=payload.email.lower(),
            display_name=payload.display_name.strip(),
            roles=("athlete",),
        )
        store.upsert_user(user)
        response = UserResponse(
            user_id=user.user_id,
            email=user.email,
            display_name=user.display_name,
            roles=list(user.roles),
            access_token=user_token_manager.mint(user),
            token_expires_at=user_token_manager.expires_at(),
        )
        return response.model_dump(mode="json"), 200

    @app.get("/api/me")
    def me() -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)
        return (
            UserResponse(
                user_id=user.user_id,
                email=user.email,
                display_name=user.display_name,
                roles=list(user.roles),
            ).model_dump(mode="json"),
            200,
        )

    @app.get("/api/athletes")
    def list_athletes() -> tuple[list[dict[str, object]], int] | tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)

        athletes = [
            AthleteResponse(
                athlete_id=athlete.athlete_id,
                owner_user_id=athlete.owner_user_id,
                display_name=athlete.display_name,
                created_at=athlete.created_at,
            ).model_dump(mode="json")
            for athlete in store.list_athletes(user.user_id)
        ]
        return athletes, 200

    @app.post("/api/athletes")
    def create_athlete() -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)

        rate_limited = require_rate_limit(f"create-athlete:{user.user_id}", limit=30, window_seconds=60)
        if rate_limited is not None:
            return rate_limited

        try:
            payload = AthleteCreateRequest.model_validate(request.get_json(force=True, silent=False))
        except ValidationError as exc:
            return json_error("invalid athlete payload", 422, details=exc.errors())

        athlete = AthleteProfile(
            athlete_id=str(uuid.uuid4()),
            owner_user_id=user.user_id,
            display_name=payload.display_name.strip(),
        )
        store.create_athlete(athlete)
        return (
            AthleteResponse(
                athlete_id=athlete.athlete_id,
                owner_user_id=athlete.owner_user_id,
                display_name=athlete.display_name,
                created_at=athlete.created_at,
            ).model_dump(mode="json"),
            201,
        )

    @app.get("/api/sessions")
    def list_sessions() -> tuple[list[dict[str, object]], int] | tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)
        items = [build_list_item(session).model_dump(mode="json") for session in store.list_sessions(user.user_id)]
        return items, 200

    @app.post("/api/sessions")
    def start_session() -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)

        rate_limited = require_rate_limit(f"start-session:{user.user_id}", limit=20, window_seconds=60)
        if rate_limited is not None:
            return rate_limited

        try:
            payload = StartSessionRequest.model_validate(request.get_json(force=True, silent=False))
        except ValidationError as exc:
            return json_error("invalid session payload", 422, details=exc.errors())

        athlete = store.get_athlete(payload.athlete_id, owner_user_id=user.user_id)
        if athlete is None:
            return json_error("athlete not found", 404)

        session_id = str(uuid.uuid4())
        session = SessionState(
            session_id=session_id,
            owner_user_id=user.user_id,
            athlete_id=athlete.athlete_id,
            athlete_display_name=athlete.display_name,
            model_version=payload.model_version or "mock-shot-model/v1",
            device_info=payload.device_info or {},
        )
        store.create(session)
        share = create_share(session_id, user.user_id, "Live viewer", expires_in_hours=72)
        store.record_audit(
            action="session.created",
            owner_user_id=user.user_id,
            actor_user_id=user.user_id,
            session_id=session_id,
            metadata={"athlete_id": athlete.athlete_id},
        )

        response = StartSessionResponse(
            session_id=session_id,
            athlete_id=athlete.athlete_id,
            athlete_display_name=athlete.display_name,
            publish_token=session_token_manager.mint_owner(session_id, SESSION_SCOPE_PUBLISH, user.user_id),
            view_token=session_token_manager.mint_owner(session_id, SESSION_SCOPE_VIEW, user.user_id),
            viewer_share_url=_build_share_url(app_public_base_url, session_id, share.token),
            token_expires_at=session_token_manager.expires_at(),
            model_version=session.model_version,
        )
        return response.model_dump(mode="json"), 201

    @app.get("/api/sessions/<session_id>")
    def session_detail(session_id: str) -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)
        if not store.session_owned_by(session_id, user.user_id):
            return json_error("forbidden", 403)

        session = store.get(session_id)
        if session is None:
            return json_error("session not found", 404)

        summary = build_summary_response(session)
        detail = SessionDetailResponse(
            **summary.model_dump(),
            share_links=[build_share_response(share) for share in session.share_links],
        )
        return detail.model_dump(mode="json"), 200

    @app.get("/api/sessions/<session_id>/summary")
    def summary(session_id: str) -> tuple[dict[str, object], int]:
        error, session = authorize_summary_request(session_id)
        if error is not None or session is None:
            return error or json_error("session not found", 404)
        return build_summary_response(session).model_dump(mode="json"), 200

    @app.post("/api/sessions/<session_id>/share")
    def create_session_share(session_id: str) -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)
        if not store.session_owned_by(session_id, user.user_id):
            return json_error("forbidden", 403)

        try:
            payload = ShareCreateRequest.model_validate(request.get_json(force=True, silent=False))
        except ValidationError as exc:
            return json_error("invalid share payload", 422, details=exc.errors())

        session = store.get(session_id)
        if session is None:
            return json_error("session not found", 404)

        share = create_share(session_id, user.user_id, payload.label.strip(), expires_in_hours=payload.expires_in_hours)
        store.record_audit(
            action="share.created",
            owner_user_id=user.user_id,
            actor_user_id=user.user_id,
            session_id=session_id,
            metadata={"share_id": share.share_id, "label": share.label},
        )
        return build_share_response(share).model_dump(mode="json"), 201

    @app.delete("/api/shares/<share_id>")
    def delete_share(share_id: str) -> tuple[dict[str, object], int]:
        user, error = require_user()
        if error is not None or user is None:
            return error or json_error("unauthorized", 401)

        revoked = store.revoke_share(share_id, user.user_id)
        if revoked is None:
            return json_error("share not found", 404)

        store.record_audit(
            action="share.revoked",
            owner_user_id=user.user_id,
            actor_user_id=user.user_id,
            session_id=revoked.session_id,
            metadata={"share_id": revoked.share_id},
        )
        return build_share_response(revoked).model_dump(mode="json"), 200

    @socketio.on("join_session")
    def handle_join_session(data: dict[str, str]) -> None:
        session_id = data.get("session_id")
        token = data.get("token")
        if not session_id or store.get(session_id) is None:
            emit("error", {"message": "invalid session_id"})
            return

        try:
            authorize_session_token(session_id, token, {SESSION_SCOPE_VIEW, SESSION_SCOPE_PUBLISH})
        except SessionTokenError as exc:
            emit("error", {"message": str(exc)})
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

        rate_limited = require_rate_limit(
            f"shot-event:{payload.session_id}:{getattr(request, 'sid', 'unknown')}",
            limit=300,
            window_seconds=60,
        )
        if rate_limited is not None:
            emit("error", {"message": "rate limit exceeded"})
            return

        token = data.get("token")
        try:
            authorize_session_token(payload.session_id, token if isinstance(token, str) else None, {SESSION_SCOPE_PUBLISH})
        except SessionTokenError as exc:
            emit("error", {"message": str(exc)})
            return

        session = store.get(payload.session_id)
        if session is None:
            emit("error", {"message": "session not found"})
            return

        event = ShotEvent(
            session_id=payload.session_id,
            event_id=payload.event_id,
            sequence=payload.sequence,
            timestamp_ms=payload.timestamp_ms,
            client_sent_at_ms=payload.client_sent_at_ms,
            x_norm=payload.x_norm,
            y_norm=payload.y_norm,
            result=payload.result,
            confidence=payload.confidence,
            inference_latency_ms=payload.inference_latency_ms,
            model_version=payload.model_version or session.model_version,
            capture_quality=payload.capture_quality,
        )
        inserted = store.append_event(event)
        if not inserted:
            return

        updated_session = store.get(payload.session_id)
        if updated_session is None:
            emit("error", {"message": "session not found"})
            return
        analytics = calculate_session_analytics(updated_session)
        payload_dict = serialize_event(event)
        payload_dict["session_stats"] = {
            "attempts": analytics.attempts,
            "makes": analytics.makes,
            "misses": analytics.misses,
            "fg_pct": analytics.fg_pct,
            "avg_latency": analytics.average_inference_latency_ms,
            "current_streak": analytics.current_streak,
            "best_streak": analytics.best_streak,
        }
        payload_dict["zone_breakdown"] = serialize_zone_breakdown(analytics.zone_breakdown)
        payload_dict["quality_flags"] = analytics.quality_flags

        socketio.emit("shot_event", payload_dict, room=payload.session_id)

    return app, socketio, store


app, socketio, _store = create_app()


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
