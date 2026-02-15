from courtvision_api.app import create_app


def test_socket_shot_event_flow() -> None:
    app, socketio, _store = create_app()
    flask_client = app.test_client()

    response = flask_client.post("/api/sessions", json={"athlete_id": "test-athlete"})
    assert response.status_code == 201
    session_id = response.get_json()["session_id"]

    client = socketio.test_client(app, flask_test_client=flask_client)
    assert client.is_connected()

    client.emit("join_session", {"session_id": session_id})
    joined_events = client.get_received()
    assert any(event["name"] == "session_joined" for event in joined_events)

    client.emit(
      "shot_event",
      {
        "session_id": session_id,
        "timestamp_ms": 1,
        "x_norm": 0.12,
        "y_norm": 0.14,
        "result": "make",
        "confidence": 0.93,
        "inference_latency_ms": 144.0,
        "release_angle_deg": 47.0,
        "elbow_angle_deg": 91.0,
        "knee_angle_deg": 113.0,
        "torso_tilt_deg": 10.0,
      },
    )

    received = client.get_received()
    shot_events = [event for event in received if event["name"] == "shot_event"]
    assert len(shot_events) == 1
    payload = shot_events[0]["args"][0]

    assert payload["result"] == "make"
    assert payload["zone"] == "left_corner_3"
    assert payload["form_score"] > 90
    assert payload["session_stats"]["attempts"] == 1
    assert payload["session_stats"]["makes"] == 1
    assert payload["session_stats"]["avg_form_score"] > 90

    client.disconnect()
