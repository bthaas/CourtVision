# CourtVision Backend

Flask + Socket.IO backend for live shot ingestion and dashboard metrics.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m courtvision_api.app
```

## Test

```bash
cd backend
pytest
```

## API

- `POST /api/sessions` starts a new workout session.
- `GET /api/sessions/<session_id>/summary` returns aggregate stats and heat map zone data.
- Socket event `join_session`: subscribe to a session room.
- Socket event `shot_event`: ingest one model inference result and broadcast updated stats.
