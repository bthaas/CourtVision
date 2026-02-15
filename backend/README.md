# CourtVision Backend

Flask + Socket.IO backend for live shot ingestion and dashboard metrics.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m courtvision_api
```

Optional Socket.IO async mode override:

```bash
CV_SOCKET_ASYNC_MODE=eventlet python -m courtvision_api
```

## Test

```bash
cd /Users/bretthaas/CourtVision
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=backend python3 -m pytest tests/backend -q
```

## API

- `POST /api/sessions` starts a new workout session.
- `GET /api/sessions/<session_id>/summary` returns aggregate stats and heat map zone data.
- Socket event `join_session`: subscribe to a session room.
- Socket event `shot_event`: ingest one model inference result and broadcast updated stats.

### Live stats payload includes

- Attempts, makes, misses, FG%
- Average inference latency
- Average form score (pose-derived)
- Current and best make streak
