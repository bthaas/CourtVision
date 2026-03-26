# CourtVision Web Dashboard

React + Vite web dashboard that subscribes to CourtVision live shot events over Socket.IO.

## Run

```bash
cd web-dashboard
npm install
cp .env.example .env
npm run dev
```

Use optional env var:

```bash
VITE_API_URL=http://localhost:5000
```

## Features

- Join an existing session or create one from the UI
- Live metrics: attempts, FG%, latency, confidence, and streaks
- Rolling shot feed with make/miss, confidence, and capture quality
- Heat map hydrated from backend summary endpoint
- Session join is only marked live after server acknowledgement
- Existing sessions require both a session ID and viewer token

## Verify

```bash
cd web-dashboard
npm run build
```
