# CourtVision Mobile

React Native (Expo) app for on-device shot inference and real-time shooting analytics.

## Run

```bash
cd mobile
npm install
npx expo start
```

Set backend URL with:

```bash
EXPO_PUBLIC_API_URL=http://<your-ip>:5000
```

## TensorFlow Lite Integration Notes

`src/services/tfliteModel.ts` currently contains a mock model with realistic latency and confidence behavior.

To switch to real TFLite:
- Create a native module bridge in iOS/Android that loads the `.tflite` model.
- Keep the `TFLiteShotModel` interface so UI/state code remains unchanged.
- Return `result`, `confidence`, `releaseAngleDeg`, pose angles, court coordinates, and `inferenceLatencyMs` per frame.

## Dashboard metrics shown in app

- Attempts, make/miss, FG%
- Average inference latency
- Average form score from pose features
- Current/best make streak
- Zone-level shooting heat map
