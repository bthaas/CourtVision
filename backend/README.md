# CourtVision Backend

Flask + Socket.IO backend for live shot ingestion and dashboard metrics.

Sessions are stored in SQLite, and access is protected with signed scoped tokens.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m courtvision_api
```

Optional Socket.IO async mode override:

```bash
CV_SOCKET_ASYNC_MODE=eventlet python -m courtvision_api
```

Important env vars:

- `CV_DB_PATH`: SQLite database file location
- `CV_SECRET_KEY`: Flask/app signing secret
- `CV_SESSION_TOKEN_SECRET`: signing secret for `view` and `publish` session tokens
- `CV_SESSION_TOKEN_MAX_AGE_SECONDS`: token lifetime in seconds

## Test

```bash
cd /Users/bretthaas/CourtVision
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=backend python3 -m pytest tests/backend -q
```

## API

- `POST /api/sessions` starts a new workout session and returns `session_id`, `publish_token`, and `view_token`.
- `GET /api/sessions/<session_id>/summary` returns aggregate stats and heat map zone data and requires `Authorization: Bearer <token>`.
- Socket event `join_session`: subscribe to a session room with `session_id` and `token`.
- Socket event `shot_event`: ingest one model inference result with `session_id`, `token`, and shot payload and broadcast updated stats.

### Live stats payload includes

- Attempts, makes, misses, FG%
- Average inference latency
- Current and best make streak
- Realtime zone breakdown for live clients
- Optional quality metadata when the client reports it
