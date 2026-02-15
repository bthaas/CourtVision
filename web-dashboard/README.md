# CourtVision Web Dashboard

React + Vite web dashboard that subscribes to CourtVision live shot events over Socket.IO.

## Run

```bash
cd web-dashboard
npm install
npm run dev
```

Use optional env var:

```bash
VITE_API_URL=http://localhost:5000
```

## Features

- Join an existing session or create one from the UI
- Live metrics: attempts, FG%, latency, form score, streaks
- Rolling shot feed with make/miss, confidence, form, and pose angles
- Heat map hydrated from backend summary endpoint
