# CourtVision

CourtVision is an AI basketball training platform with a React Native mobile client, Flask + WebSocket backend, and a real-time web dashboard.

## Resume-aligned highlights

- On-device shot inference interface designed for TensorFlow Lite deployment.
- Real-time make/miss event streaming over WebSockets to mobile and web dashboards.
- Custom pose-estimation metric pipeline (elbow, knee, torso angles) powering shot form scoring.
- Zone-based heat maps and session metrics including FG%, streaks, form score, and inference latency.
- Architecture designed to support sub-200ms model inference with live feedback.

## Project structure

- `mobile/`: React Native (Expo + TypeScript) app.
- `backend/`: Flask + Flask-SocketIO API for sessions and live updates.
- `web-dashboard/`: React + Vite browser dashboard client.
- `tests/backend/`: backend unit and socket flow tests.

## Architecture

1. Mobile client starts a session using `POST /api/sessions`.
2. Mobile inference pipeline produces shot predictions and pose-derived features.
3. Client emits `shot_event` over Socket.IO.
4. Backend aggregates stats, form score, and zone heat map buckets.
5. Backend broadcasts live updates to subscribed mobile/web clients.

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

### Web dashboard

```bash
cd web-dashboard
npm install
VITE_API_URL=http://localhost:5000 npm run dev
```

## Verification

```bash
cd /Users/bretthaas/CourtVision
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=backend python3 -m pytest tests/backend -q
```

Includes a Socket.IO flow test that validates join, shot ingestion, live stat broadcast, and form score payloads.
