from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Final

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .models import UserProfile

SESSION_SCOPE_VIEW: Final = "view"
SESSION_SCOPE_PUBLISH: Final = "publish"
SESSION_GRANT_OWNER: Final = "owner"
SESSION_GRANT_SHARE: Final = "share"


class SessionTokenError(ValueError):
    pass


class UserTokenError(ValueError):
    pass


@dataclass(slots=True)
class SessionGrant:
    session_id: str
    scope: str
    grant_kind: str
    owner_user_id: str | None = None
    share_id: str | None = None


class UserTokenManager:
    def __init__(self, secret: str, max_age_seconds: int) -> None:
        self._serializer = URLSafeTimedSerializer(secret_key=secret, salt="courtvision-user-token")
        self._max_age_seconds = max_age_seconds

    def mint(self, user: UserProfile) -> str:
        return self._serializer.dumps(
            {
                "user_id": user.user_id,
                "email": user.email,
                "display_name": user.display_name,
                "roles": list(user.roles),
            }
        )

    def verify(self, token: str) -> UserProfile:
        try:
            payload = self._serializer.loads(token, max_age=self._max_age_seconds)
        except SignatureExpired as exc:
            raise UserTokenError("user token expired") from exc
        except BadSignature as exc:
            raise UserTokenError("invalid user token") from exc

        user_id = payload.get("user_id")
        email = payload.get("email")
        display_name = payload.get("display_name")
        roles = payload.get("roles", ["athlete"])
        if not isinstance(user_id, str) or not isinstance(email, str) or not isinstance(display_name, str):
            raise UserTokenError("invalid user token")

        safe_roles = tuple(role for role in roles if isinstance(role, str))
        return UserProfile(
            user_id=user_id,
            email=email,
            display_name=display_name,
            roles=safe_roles or ("athlete",),
        )

    def expires_at(self) -> datetime:
        return datetime.now(timezone.utc) + timedelta(seconds=self._max_age_seconds)


class SessionTokenManager:
    def __init__(self, secret: str, max_age_seconds: int) -> None:
        self._serializer = URLSafeTimedSerializer(secret_key=secret, salt="courtvision-session-token")
        self._max_age_seconds = max_age_seconds

    def mint_owner(self, session_id: str, scope: str, owner_user_id: str) -> str:
        return self._serializer.dumps(
            {
                "session_id": session_id,
                "scope": scope,
                "grant_kind": SESSION_GRANT_OWNER,
                "owner_user_id": owner_user_id,
            }
        )

    def mint_share(self, session_id: str, share_id: str) -> str:
        return self._serializer.dumps(
            {
                "session_id": session_id,
                "scope": SESSION_SCOPE_VIEW,
                "grant_kind": SESSION_GRANT_SHARE,
                "share_id": share_id,
            }
        )

    def verify(self, token: str, session_id: str, allowed_scopes: set[str]) -> SessionGrant:
        try:
            payload = self._serializer.loads(token, max_age=self._max_age_seconds)
        except SignatureExpired as exc:
            raise SessionTokenError("session token expired") from exc
        except BadSignature as exc:
            raise SessionTokenError("invalid session token") from exc

        token_session_id = payload.get("session_id")
        scope = payload.get("scope")
        grant_kind = payload.get("grant_kind", SESSION_GRANT_OWNER)

        if token_session_id != session_id:
            raise SessionTokenError("session token does not match session")
        if scope not in allowed_scopes:
            raise SessionTokenError("session token does not have required scope")
        if grant_kind not in {SESSION_GRANT_OWNER, SESSION_GRANT_SHARE}:
            raise SessionTokenError("invalid session token")

        return SessionGrant(
            session_id=session_id,
            scope=scope,
            grant_kind=grant_kind,
            owner_user_id=payload.get("owner_user_id"),
            share_id=payload.get("share_id"),
        )

    def expires_at(self) -> datetime:
        return datetime.now(timezone.utc) + timedelta(seconds=self._max_age_seconds)
