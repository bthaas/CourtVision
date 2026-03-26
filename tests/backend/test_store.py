from courtvision_api.models import AthleteProfile, SessionState, ShotEvent, ShotResult, UserProfile
from courtvision_api.store import SessionStore


def test_store_create_and_get(tmp_path) -> None:
    db_path = tmp_path / "courtvision.sqlite"
    store = SessionStore(str(db_path))
    store.upsert_user(UserProfile(user_id="user-1", email="test@example.com", display_name="Test User"))
    store.create_athlete(
        AthleteProfile(athlete_id="athlete", owner_user_id="user-1", display_name="Test Athlete")
    )
    session = SessionState(
        session_id="abc",
        owner_user_id="user-1",
        athlete_id="athlete",
        athlete_display_name="Test Athlete",
    )

    store.create(session)

    persisted = store.get("abc")
    assert persisted is not None
    assert persisted.session_id == session.session_id
    assert persisted.owner_user_id == "user-1"
    assert persisted.athlete_display_name == "Test Athlete"
    assert store.get("missing") is None


def test_store_persists_events_across_instances(tmp_path) -> None:
    db_path = tmp_path / "courtvision.sqlite"
    store = SessionStore(str(db_path))
    store.upsert_user(UserProfile(user_id="user-1", email="test@example.com", display_name="Test User"))
    store.create_athlete(
        AthleteProfile(athlete_id="athlete", owner_user_id="user-1", display_name="Test Athlete")
    )
    session = SessionState(
        session_id="abc",
        owner_user_id="user-1",
        athlete_id="athlete",
        athlete_display_name="Test Athlete",
    )
    store.create(session)
    store.append_event(
        ShotEvent(
            session_id="abc",
            event_id="event-1",
            sequence=1,
            timestamp_ms=1,
            x_norm=0.2,
            y_norm=0.3,
            result=ShotResult.MAKE,
            confidence=0.95,
            inference_latency_ms=120.0,
        )
    )

    reopened = SessionStore(str(db_path))
    persisted = reopened.get("abc")

    assert persisted is not None
    assert persisted.athlete_id == "athlete"
    assert persisted.owner_user_id == "user-1"
    assert len(persisted.events) == 1
    assert persisted.events[0].result == ShotResult.MAKE
