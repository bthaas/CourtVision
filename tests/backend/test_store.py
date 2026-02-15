from courtvision_api.models import SessionState
from courtvision_api.store import SessionStore


def test_store_create_and_get() -> None:
    store = SessionStore()
    session = SessionState(session_id="abc", athlete_id="athlete")

    store.create(session)

    assert store.get("abc") == session
    assert store.get("missing") is None
