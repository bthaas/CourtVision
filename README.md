# CourtVision

CourtVision is a basketball shooting tracker with a React Native mobile client, Flask + WebSocket backend, and a real-time web dashboard.

## Resume-aligned highlights

- On-device shot tracking interface designed for TensorFlow Lite deployment.
- Real-time make/miss event streaming over WebSockets to mobile and web dashboards.
- Zone-based heat maps and session metrics including FG%, streaks, confidence, and inference latency.
- Architecture designed to support sub-200ms model inference with live feedback.

## Project structure

- `mobile/`: React Native (Expo + TypeScript) app.
- `backend/`: Flask + Flask-SocketIO API for sessions and live updates.
- `web-dashboard/`: React + Vite browser dashboard client.
- `tests/backend/`: backend unit and socket flow tests.

## Current implementation status

What is fully implemented today:

- Dev-authenticated user bootstrap, athlete creation, user-owned session history, share links, and scoped session tokens.
- Session creation, live Socket.IO joins, idempotent shot ingestion, and realtime stat broadcasts.
- Mobile live session UI with make/miss feedback, shot recap modals, heat map updates, and end-of-session sharing.
- Web dashboard for creating protected sessions, joining via share link or token, viewing recent history, and watching live metrics.
- Backend analytics for FG%, streaks, average latency, zone-level shooting breakdowns, and trust-quality flags.
- Durable SQLite-backed session persistence across backend restarts.
- A reproducible TensorFlow baseline trainer in `ml/train_baseline_model.py` that exports a real `.tflite` artifact plus manifest.
- A reproducible public-data trainer in `ml/train_shotdetail_model.py` that learns shot-make probability from real labeled NBA shot metadata and exports weights plus preprocessing metadata.

What is intentionally still simulated:

- `mobile/src/services/tfliteModel.ts` uses a mock shot tracker model with realistic timing and output ranges.
- The repo now includes Expo dev-build scaffolding (`mobile/eas.json` and `npm run start:dev-client`), but there is still no native inference bridge wired into the mobile app.
- The exported ML artifact is currently trained on synthetic structured features, not real labeled basketball footage.
- The new real-data shot model is trained on public tabular shot labels, not frame-level basketball video, so it should be presented as a baseline analytics model rather than a finished CV system.

## Secure access model

- `POST /api/dev/login` bootstraps a signed local user token for development.
- `POST /api/sessions` requires an authenticated owner, returns owner `publish_token` / `view_token`, and also returns a `viewer_share_url`.
- Summary reads require `Authorization: Bearer <view-or-publish-token>`.
- Socket joins require a valid token, and shot publishes require a `publish_token`.
- Share links can be revoked server-side, and sessions are tied to owner-created athlete profiles.

## Architecture

1. Mobile client starts a session using `POST /api/sessions`.
2. Mobile inference pipeline produces shot predictions and court-location estimates.
3. Client emits `shot_event` over Socket.IO.
4. Backend aggregates stats and zone heat map buckets.
5. Backend broadcasts live updates to subscribed mobile/web clients.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m courtvision_api
```

### Mobile

```bash
cd mobile
npm install
cp .env.example .env
npm run start:dev-client
```

### Web dashboard

```bash
cd web-dashboard
npm install
cp .env.example .env
npm run dev
```

## Verification

```bash
cd /Users/bretthaas/CourtVision
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=backend python3 -m pytest tests/backend -q
```

```bash
cd mobile
npm run typecheck
```

```bash
cd web-dashboard
npm run build
```

```bash
cd /Users/bretthaas/CourtVision
python3 ml/train_baseline_model.py
```

```bash
cd /Users/bretthaas/CourtVision
python3 ml/train_shotdetail_model.py
```

## CI

GitHub Actions is configured in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) to run:

- Backend tests
- Mobile typecheck
- Web dashboard production build

## Roadmap

- Replace the mock mobile inference service with a real camera + TensorFlow Lite pipeline.
- Add authenticated share flows so live sessions can be safely viewed by others.
- Add a shared Socket.IO message queue so realtime fanout remains correct in multi-instance deployments.
- If pose/form coaching is revisited later, start from [docs/future_pose_research.md](./docs/future_pose_research.md) instead of rebuilding shipping product scope around it today.
