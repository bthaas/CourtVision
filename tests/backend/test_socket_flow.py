from courtvision_api.app import create_app


def bootstrap_user_and_athlete(flask_client):
    login_response = flask_client.post(
        "/api/dev/login",
        json={"display_name": "Test Athlete", "email": "test@example.com"},
    )
    assert login_response.status_code == 200
    auth_payload = login_response.get_json()
    access_token = auth_payload["access_token"]

    athlete_response = flask_client.post(
        "/api/athletes",
        json={"display_name": "Test Athlete"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert athlete_response.status_code == 201
    athlete_id = athlete_response.get_json()["athlete_id"]
    return access_token, athlete_id


def create_session(flask_client):
    access_token, athlete_id = bootstrap_user_and_athlete(flask_client)
    response = flask_client.post(
        "/api/sessions",
        json={"athlete_id": athlete_id, "model_version": "test-model/v1"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 201
    return access_token, athlete_id, response.get_json()


def test_socket_shot_event_flow(tmp_path) -> None:
    app, socketio, _store = create_app(
        db_path=str(tmp_path / "courtvision.sqlite"),
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    flask_client = app.test_client()

    _access_token, _athlete_id, session_payload = create_session(flask_client)
    session_id = session_payload["session_id"]
    publish_token = session_payload["publish_token"]
    view_token = session_payload["view_token"]

    client = socketio.test_client(app, flask_test_client=flask_client)
    assert client.is_connected()

    client.emit("join_session", {"session_id": session_id, "token": view_token})
    joined_events = client.get_received()
    assert any(event["name"] == "session_joined" for event in joined_events)

    client.emit(
        "shot_event",
        {
            "session_id": session_id,
            "token": publish_token,
            "event_id": "event-1",
            "sequence": 1,
            "timestamp_ms": 1,
            "client_sent_at_ms": 1,
            "x_norm": 0.12,
            "y_norm": 0.14,
            "result": "make",
            "confidence": 0.93,
            "inference_latency_ms": 144.0,
            "model_version": "test-model/v1",
            "capture_quality": "high",
        },
    )

    received = client.get_received()
    shot_events = [event for event in received if event["name"] == "shot_event"]
    assert len(shot_events) == 1
    payload = shot_events[0]["args"][0]

    assert payload["result"] == "make"
    assert payload["zone"] == "left_corner_3"
    assert payload["event_id"] == "event-1"
    assert payload["session_stats"]["attempts"] == 1
    assert payload["session_stats"]["makes"] == 1
    assert payload["zone_breakdown"]["left_corner_3"]["attempts"] == 1
    assert payload["zone_breakdown"]["left_corner_3"]["makes"] == 1

    summary_response = flask_client.get(
        f"/api/sessions/{session_id}/summary",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert summary_response.status_code == 200
    assert summary_response.get_json()["attempts"] == 1

    client.disconnect()


def test_summary_requires_valid_token(tmp_path) -> None:
    app, _socketio, _store = create_app(
        db_path=str(tmp_path / "courtvision.sqlite"),
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    flask_client = app.test_client()

    _access_token, _athlete_id, session_payload = create_session(flask_client)
    session_id = session_payload["session_id"]

    missing_token = flask_client.get(f"/api/sessions/{session_id}/summary")
    assert missing_token.status_code == 401
    assert missing_token.get_json() == {"error": "missing session token"}

    invalid_token = flask_client.get(
        f"/api/sessions/{session_id}/summary",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert invalid_token.status_code == 403
    assert invalid_token.get_json() == {"error": "invalid session token"}


def test_view_token_cannot_publish_shots(tmp_path) -> None:
    app, socketio, _store = create_app(
        db_path=str(tmp_path / "courtvision.sqlite"),
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    flask_client = app.test_client()

    _access_token, _athlete_id, payload = create_session(flask_client)
    session_id = payload["session_id"]
    view_token = payload["view_token"]

    client = socketio.test_client(app, flask_test_client=flask_client)
    client.emit("join_session", {"session_id": session_id, "token": view_token})
    client.get_received()

    client.emit(
        "shot_event",
        {
            "session_id": session_id,
            "token": view_token,
            "event_id": "event-1",
            "sequence": 1,
            "timestamp_ms": 1,
            "x_norm": 0.12,
            "y_norm": 0.14,
            "result": "make",
            "confidence": 0.93,
            "inference_latency_ms": 144.0,
        },
    )

    received = client.get_received()
    assert received[0]["name"] == "error"
    assert received[0]["args"][0]["message"] == "session token does not have required scope"


def test_session_persists_across_app_instances(tmp_path) -> None:
    db_path = str(tmp_path / "courtvision.sqlite")
    app, socketio, _store = create_app(
        db_path=db_path,
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    flask_client = app.test_client()

    _access_token, _athlete_id, payload = create_session(flask_client)
    session_id = payload["session_id"]
    publish_token = payload["publish_token"]
    view_token = payload["view_token"]

    client = socketio.test_client(app, flask_test_client=flask_client)
    client.emit("join_session", {"session_id": session_id, "token": view_token})
    client.get_received()
    client.emit(
        "shot_event",
        {
            "session_id": session_id,
            "token": publish_token,
            "event_id": "event-1",
            "sequence": 1,
            "timestamp_ms": 1,
            "x_norm": 0.12,
            "y_norm": 0.14,
            "result": "make",
            "confidence": 0.93,
            "inference_latency_ms": 144.0,
        },
    )
    client.get_received()
    client.disconnect()

    reloaded_app, _reloaded_socketio, _reloaded_store = create_app(
        db_path=db_path,
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    reloaded_client = reloaded_app.test_client()
    summary_response = reloaded_client.get(
        f"/api/sessions/{session_id}/summary",
        headers={"Authorization": f"Bearer {view_token}"},
    )

    assert summary_response.status_code == 200
    assert summary_response.get_json()["attempts"] == 1


def test_start_session_rejects_invalid_json_with_json_error(tmp_path) -> None:
    app, _socketio, _store = create_app(
        db_path=str(tmp_path / "courtvision.sqlite"),
        secret_key="test-secret",
        token_secret="test-token-secret",
    )
    flask_client = app.test_client()

    access_token, athlete_id = bootstrap_user_and_athlete(flask_client)
    response = flask_client.post(
        "/api/sessions",
        data="not-json",
        content_type="application/json",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "invalid request body"}
