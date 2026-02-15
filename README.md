# CourtVision

CourtVision is an AI basketball training platform with a React Native mobile client and a Flask + WebSocket backend for live shot analytics.

## Resume-aligned highlights

- On-device shot inference interface designed for TensorFlow Lite deployment.
- Real-time make/miss event streaming over WebSockets to a live performance dashboard.
- Custom pose-estimation metric pipeline (elbow, knee, torso angles) powering shot form scoring.
- Zone-based heat maps and session metrics including FG%, streaks, form score, and inference latency.
- Architecture designed to support sub-200ms model inference with live mobile feedback.

## Project structure

- `mobile/`: React Native (Expo + TypeScript) app.
- `backend/`: Flask + Flask-SocketIO API for sessions and live updates.
- `tests/backend/`: analytics unit tests.

## Architecture

1. Mobile client starts a session using `POST /api/sessions`.
2. Mobile inference pipeline produces shot predictions and pose-derived features.
3. Client emits `shot_event` over Socket.IO.
4. Backend aggregates stats, form score, and zone heat map buckets.
5. Backend broadcasts live updates to subscribed dashboard clients.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m courtvision_api
```

### Mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:5000 npx expo start
```

## Current implementation notes

- `mobile/src/services/tfliteModel.ts` ships with a mock model that mirrors real TFLite integration contracts.
- Replace the mock with native iOS/Android model bindings while preserving `TFLiteShotModel` interface.
- Backend currently uses in-memory session storage and can be upgraded to Redis/Postgres for production.
