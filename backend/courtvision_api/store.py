from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from .models import (
    AthleteProfile,
    CaptureQuality,
    SessionState,
    ShareLink,
    ShotEvent,
    ShotResult,
    UserProfile,
)

_LEGACY_USER_ID = "legacy-demo"
_LEGACY_EMAIL = "legacy@courtvision.local"
_LEGACY_NAME = "Legacy Demo"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionStore:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._lock = Lock()
        self._connection = sqlite3.connect(db_path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._initialize()

    def _initialize(self) -> None:
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

        with self._lock:
            self._connection.execute("PRAGMA foreign_keys = ON")
            if self._db_path != ":memory:":
                self._connection.execute("PRAGMA journal_mode = WAL")

            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    roles TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS athletes (
                    athlete_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    owner_user_id TEXT,
                    athlete_id TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    model_version TEXT,
                    device_info_json TEXT,
                    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
                    FOREIGN KEY (athlete_id) REFERENCES athletes(athlete_id) ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS shares (
                    share_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    label TEXT NOT NULL,
                    token TEXT NOT NULL,
                    expires_at TEXT,
                    revoked_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
                    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    owner_user_id TEXT,
                    actor_user_id TEXT,
                    action TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_id TEXT,
                    sequence INTEGER,
                    timestamp_ms INTEGER NOT NULL,
                    client_sent_at_ms INTEGER,
                    x_norm REAL NOT NULL,
                    y_norm REAL NOT NULL,
                    result TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    inference_latency_ms REAL NOT NULL,
                    model_version TEXT,
                    capture_quality TEXT,
                    pose_detected INTEGER,
                    release_angle_deg REAL,
                    elbow_angle_deg REAL,
                    knee_angle_deg REAL,
                    torso_tilt_deg REAL,
                    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                );
                """
            )
            self._migrate_existing_schema()
            self._connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_events_session_sequence
                ON events (session_id, sequence, id)
                """
            )
            self._connection.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_events_session_event_id
                ON events (session_id, event_id)
                """
            )
            self._connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_shares_session_id
                ON shares (session_id, created_at DESC)
                """
            )
            self._connection.commit()

    def _migrate_existing_schema(self) -> None:
        self._ensure_column("sessions", "owner_user_id", "TEXT")
        self._ensure_column("sessions", "model_version", "TEXT")
        self._ensure_column("sessions", "device_info_json", "TEXT")
        self._ensure_column("events", "event_id", "TEXT")
        self._ensure_column("events", "sequence", "INTEGER")
        self._ensure_column("events", "client_sent_at_ms", "INTEGER")
        self._ensure_column("events", "model_version", "TEXT")
        self._ensure_column("events", "capture_quality", "TEXT")
        self._ensure_column("events", "pose_detected", "INTEGER")

        created_at = _utcnow().isoformat()
        self._connection.execute(
            """
            INSERT OR IGNORE INTO users (user_id, email, display_name, roles, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (_LEGACY_USER_ID, _LEGACY_EMAIL, _LEGACY_NAME, "athlete", created_at),
        )

        self._connection.execute(
            """
            UPDATE sessions
            SET owner_user_id = ?
            WHERE owner_user_id IS NULL OR owner_user_id = ''
            """,
            (_LEGACY_USER_ID,),
        )
        self._connection.execute(
            """
            UPDATE events
            SET event_id = printf('legacy-%s', id)
            WHERE event_id IS NULL OR event_id = ''
            """
        )
        self._connection.execute(
            """
            UPDATE events
            SET sequence = id
            WHERE sequence IS NULL
            """
        )
        self._connection.execute(
            """
            UPDATE events
            SET client_sent_at_ms = timestamp_ms
            WHERE client_sent_at_ms IS NULL
            """
        )
        self._connection.execute(
            """
            UPDATE events
            SET pose_detected = CASE
                WHEN elbow_angle_deg IS NOT NULL OR knee_angle_deg IS NOT NULL OR torso_tilt_deg IS NOT NULL THEN 1
                ELSE 0
            END
            WHERE pose_detected IS NULL
            """
        )
        self._connection.execute(
            """
            UPDATE events
            SET capture_quality = 'medium'
            WHERE capture_quality IS NULL
            """
        )
        self._connection.execute(
            """
            INSERT OR IGNORE INTO athletes (athlete_id, owner_user_id, display_name, created_at)
            SELECT
                sessions.athlete_id,
                sessions.owner_user_id,
                sessions.athlete_id,
                MIN(sessions.started_at)
            FROM sessions
            GROUP BY sessions.athlete_id, sessions.owner_user_id
            """
        )

    def _ensure_column(self, table: str, column: str, definition: str) -> None:
        columns = {
            row["name"]
            for row in self._connection.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if column in columns:
            return
        self._connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def ping(self) -> None:
        with self._lock:
            self._connection.execute("SELECT 1").fetchone()

    def upsert_user(self, user: UserProfile) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO users (user_id, email, display_name, roles, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    email = excluded.email,
                    display_name = excluded.display_name,
                    roles = excluded.roles
                """,
                (
                    user.user_id,
                    user.email,
                    user.display_name,
                    ",".join(user.roles),
                    user.created_at.isoformat(),
                ),
            )
            self._connection.commit()

    def get_user(self, user_id: str) -> UserProfile | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT user_id, email, display_name, roles, created_at
                FROM users
                WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
        return self._row_to_user(row) if row is not None else None

    def create_athlete(self, athlete: AthleteProfile) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO athletes (athlete_id, owner_user_id, display_name, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    athlete.athlete_id,
                    athlete.owner_user_id,
                    athlete.display_name,
                    athlete.created_at.isoformat(),
                ),
            )
            self._connection.commit()

    def list_athletes(self, owner_user_id: str) -> list[AthleteProfile]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT athlete_id, owner_user_id, display_name, created_at
                FROM athletes
                WHERE owner_user_id = ?
                ORDER BY created_at ASC
                """,
                (owner_user_id,),
            ).fetchall()
        return [self._row_to_athlete(row) for row in rows]

    def get_athlete(self, athlete_id: str, owner_user_id: str | None = None) -> AthleteProfile | None:
        query = """
            SELECT athlete_id, owner_user_id, display_name, created_at
            FROM athletes
            WHERE athlete_id = ?
        """
        params: list[str] = [athlete_id]
        if owner_user_id is not None:
            query += " AND owner_user_id = ?"
            params.append(owner_user_id)

        with self._lock:
            row = self._connection.execute(query, tuple(params)).fetchone()
        return self._row_to_athlete(row) if row is not None else None

    def create(self, session: SessionState) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO sessions (
                    session_id,
                    owner_user_id,
                    athlete_id,
                    started_at,
                    model_version,
                    device_info_json
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session.session_id,
                    session.owner_user_id,
                    session.athlete_id,
                    session.started_at.isoformat(),
                    session.model_version,
                    json.dumps(session.device_info),
                ),
            )
            self._connection.commit()

    def append_event(self, event: ShotEvent) -> bool:
        with self._lock:
            try:
                self._connection.execute(
                    """
                    INSERT INTO events (
                        session_id,
                        event_id,
                        sequence,
                        timestamp_ms,
                        client_sent_at_ms,
                        x_norm,
                        y_norm,
                        result,
                        confidence,
                        inference_latency_ms,
                        model_version,
                        capture_quality,
                        pose_detected,
                        release_angle_deg,
                        elbow_angle_deg,
                        knee_angle_deg,
                        torso_tilt_deg
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event.session_id,
                        event.event_id,
                        event.sequence,
                        event.timestamp_ms,
                        event.client_sent_at_ms,
                        event.x_norm,
                        event.y_norm,
                        event.result.value,
                        event.confidence,
                        event.inference_latency_ms,
                        event.model_version,
                        event.capture_quality.value if event.capture_quality is not None else None,
                        1 if event.pose_detected else 0,
                        event.release_angle_deg,
                        event.elbow_angle_deg,
                        event.knee_angle_deg,
                        event.torso_tilt_deg,
                    ),
                )
            except sqlite3.IntegrityError:
                return False

            self._connection.commit()
            return True

    def create_share(self, share: ShareLink) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO shares (
                    share_id,
                    session_id,
                    owner_user_id,
                    label,
                    token,
                    expires_at,
                    revoked_at,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    share.share_id,
                    share.session_id,
                    share.owner_user_id,
                    share.label,
                    share.token,
                    share.expires_at.isoformat() if share.expires_at is not None else None,
                    share.revoked_at.isoformat() if share.revoked_at is not None else None,
                    share.created_at.isoformat(),
                ),
            )
            self._connection.commit()

    def list_shares(self, session_id: str) -> list[ShareLink]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT share_id, session_id, owner_user_id, label, token, expires_at, revoked_at, created_at
                FROM shares
                WHERE session_id = ?
                ORDER BY created_at DESC
                """,
                (session_id,),
            ).fetchall()
        return [self._row_to_share(row) for row in rows]

    def get_share(self, share_id: str) -> ShareLink | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT share_id, session_id, owner_user_id, label, token, expires_at, revoked_at, created_at
                FROM shares
                WHERE share_id = ?
                """,
                (share_id,),
            ).fetchone()
        return self._row_to_share(row) if row is not None else None

    def revoke_share(self, share_id: str, owner_user_id: str) -> ShareLink | None:
        revoked_at = _utcnow().isoformat()
        with self._lock:
            cursor = self._connection.execute(
                """
                UPDATE shares
                SET revoked_at = ?
                WHERE share_id = ? AND owner_user_id = ? AND revoked_at IS NULL
                """,
                (revoked_at, share_id, owner_user_id),
            )
            if cursor.rowcount == 0:
                return None
            self._connection.commit()
        return self.get_share(share_id)

    def record_audit(
        self,
        *,
        action: str,
        owner_user_id: str | None,
        actor_user_id: str | None,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO audit_logs (
                    session_id,
                    owner_user_id,
                    actor_user_id,
                    action,
                    metadata_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    owner_user_id,
                    actor_user_id,
                    action,
                    json.dumps(metadata or {}, sort_keys=True),
                    _utcnow().isoformat(),
                ),
            )
            self._connection.commit()

    def session_owned_by(self, session_id: str, user_id: str) -> bool:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT 1
                FROM sessions
                WHERE session_id = ? AND owner_user_id = ?
                """,
                (session_id, user_id),
            ).fetchone()
        return row is not None

    def get(self, session_id: str) -> SessionState | None:
        with self._lock:
            session_row = self._connection.execute(
                """
                SELECT
                    sessions.session_id,
                    sessions.owner_user_id,
                    sessions.athlete_id,
                    athletes.display_name AS athlete_display_name,
                    sessions.started_at,
                    sessions.model_version,
                    sessions.device_info_json
                FROM sessions
                INNER JOIN athletes ON athletes.athlete_id = sessions.athlete_id
                WHERE sessions.session_id = ?
                """,
                (session_id,),
            ).fetchone()

            if session_row is None:
                return None

            event_rows = self._connection.execute(
                """
                SELECT
                    session_id,
                    event_id,
                    sequence,
                    timestamp_ms,
                    client_sent_at_ms,
                    x_norm,
                    y_norm,
                    result,
                    confidence,
                    inference_latency_ms,
                    model_version,
                    capture_quality,
                    pose_detected,
                    release_angle_deg,
                    elbow_angle_deg,
                    knee_angle_deg,
                    torso_tilt_deg
                FROM events
                WHERE session_id = ?
                ORDER BY sequence ASC, id ASC
                """,
                (session_id,),
            ).fetchall()
            share_rows = self._connection.execute(
                """
                SELECT share_id, session_id, owner_user_id, label, token, expires_at, revoked_at, created_at
                FROM shares
                WHERE session_id = ?
                ORDER BY created_at DESC
                """,
                (session_id,),
            ).fetchall()

        return SessionState(
            session_id=session_row["session_id"],
            owner_user_id=session_row["owner_user_id"],
            athlete_id=session_row["athlete_id"],
            athlete_display_name=session_row["athlete_display_name"],
            started_at=datetime.fromisoformat(session_row["started_at"]),
            model_version=session_row["model_version"],
            device_info=self._decode_json(session_row["device_info_json"]),
            events=[self._row_to_event(row) for row in event_rows],
            share_links=[self._row_to_share(row) for row in share_rows],
        )

    def list_sessions(self, owner_user_id: str) -> list[SessionState]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT session_id
                FROM sessions
                WHERE owner_user_id = ?
                ORDER BY started_at DESC
                """,
                (owner_user_id,),
            ).fetchall()
        return [session for row in rows if (session := self.get(row["session_id"])) is not None]

    def all(self) -> list[SessionState]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT session_id
                FROM sessions
                ORDER BY started_at DESC
                """
            ).fetchall()
        return [session for row in rows if (session := self.get(row["session_id"])) is not None]

    @staticmethod
    def _decode_json(value: str | None) -> dict[str, Any]:
        if not value:
            return {}
        decoded = json.loads(value)
        return decoded if isinstance(decoded, dict) else {}

    @staticmethod
    def _row_to_user(row: sqlite3.Row) -> UserProfile:
        roles = tuple(filter(None, (role.strip() for role in row["roles"].split(","))))
        return UserProfile(
            user_id=row["user_id"],
            email=row["email"],
            display_name=row["display_name"],
            roles=roles or ("athlete",),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_athlete(row: sqlite3.Row) -> AthleteProfile:
        return AthleteProfile(
            athlete_id=row["athlete_id"],
            owner_user_id=row["owner_user_id"],
            display_name=row["display_name"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_share(row: sqlite3.Row) -> ShareLink:
        return ShareLink(
            share_id=row["share_id"],
            session_id=row["session_id"],
            owner_user_id=row["owner_user_id"],
            label=row["label"],
            token=row["token"],
            expires_at=datetime.fromisoformat(row["expires_at"]) if row["expires_at"] else None,
            revoked_at=datetime.fromisoformat(row["revoked_at"]) if row["revoked_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> ShotEvent:
        capture_quality = row["capture_quality"]
        return ShotEvent(
            session_id=row["session_id"],
            event_id=row["event_id"],
            sequence=row["sequence"],
            timestamp_ms=row["timestamp_ms"],
            client_sent_at_ms=row["client_sent_at_ms"],
            x_norm=row["x_norm"],
            y_norm=row["y_norm"],
            result=ShotResult(row["result"]),
            confidence=row["confidence"],
            inference_latency_ms=row["inference_latency_ms"],
            model_version=row["model_version"],
            capture_quality=CaptureQuality(capture_quality) if capture_quality else None,
            pose_detected=bool(row["pose_detected"]),
            release_angle_deg=row["release_angle_deg"],
            elbow_angle_deg=row["elbow_angle_deg"],
            knee_angle_deg=row["knee_angle_deg"],
            torso_tilt_deg=row["torso_tilt_deg"],
        )
