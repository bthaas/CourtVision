from __future__ import annotations

from collections.abc import MutableMapping

from .models import SessionState


class SessionStore:
    def __init__(self) -> None:
        self._sessions: MutableMapping[str, SessionState] = {}

    def create(self, session: SessionState) -> None:
        self._sessions[session.session_id] = session

    def get(self, session_id: str) -> SessionState | None:
        return self._sessions.get(session_id)

    def all(self) -> list[SessionState]:
        return list(self._sessions.values())
