import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASELINE_MODEL_VERSION,
  ReadinessCheck,
  RUNTIME_MODE_DETAIL,
  RUNTIME_MODE_LABEL,
} from "../constants/runtime";
import {
  createAthlete,
  getSummary,
  listAthletes,
  listSessions,
  loginDevUser,
  startSession,
} from "../services/api";
import { TrainingSessionController } from "../services/trainingSession";
import {
  AthleteProfile,
  AuthSession,
  SessionListItem,
  SessionStats,
  ShotInference,
  ZoneName,
  ZoneStat,
} from "../types/analytics";

type SessionPhase = "idle" | "starting" | "running" | "stopped" | "error";

const DEMO_PROFILE = {
  displayName: "CourtVision Athlete",
  email: "mobile-demo@courtvision.local",
};

const emptyStats: SessionStats = {
  attempts: 0,
  makes: 0,
  misses: 0,
  fgPct: 0,
  avgLatency: 0,
  currentStreak: 0,
  bestStreak: 0,
};

const zoneNames: ZoneName[] = [
  "left_corner_3",
  "left_wing_3",
  "top_key_3",
  "right_wing_3",
  "right_corner_3",
  "left_midrange",
  "center_paint",
  "right_midrange",
];

const defaultZones = (): Record<ZoneName, ZoneStat> =>
  zoneNames.reduce(
    (acc, key) => ({ ...acc, [key]: { attempts: 0, makes: 0, percentage: 0 } }),
    {} as Record<ZoneName, ZoneStat>
  );

function summaryShotsToInference(shots: Array<{
  session_id: string;
  event_id: string;
  sequence: number;
  timestamp_ms: number;
  client_sent_at_ms?: number | null;
  x_norm: number;
  y_norm: number;
  zone: ZoneName;
  result: "make" | "miss";
  confidence: number;
  inference_latency_ms: number;
  model_version?: string | null;
  capture_quality?: "high" | "medium" | "low" | "unusable" | null;
}>): ShotInference[] {
  return shots.map((shot) => ({
    sessionId: shot.session_id,
    eventId: shot.event_id,
    sequence: shot.sequence,
    timestampMs: shot.timestamp_ms,
    clientSentAtMs: shot.client_sent_at_ms ?? undefined,
    xNorm: shot.x_norm,
    yNorm: shot.y_norm,
    zone: shot.zone,
    result: shot.result,
    confidence: shot.confidence,
    inferenceLatencyMs: shot.inference_latency_ms,
    modelVersion: shot.model_version ?? undefined,
    captureQuality: shot.capture_quality ?? undefined,
  }));
}

export function useCourtVisionSession() {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [viewerShareUrl, setViewerShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [lastShot, setLastShot] = useState<ShotInference | null>(null);
  const [shots, setShots] = useState<ShotInference[]>([]);
  const [zones, setZones] = useState<Record<ZoneName, ZoneStat>>(defaultZones);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionListItem[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const controllerRef = useRef<TrainingSessionController | null>(null);
  const shotListenerCleanupRef = useRef<(() => void) | null>(null);

  const canStart = useMemo(
    () => !bootstrapping && auth != null && athlete != null && phase !== "starting" && phase !== "running",
    [athlete, auth, bootstrapping, phase]
  );

  const readinessChecks = useMemo<ReadinessCheck[]>(
    () => [
      {
        label: "Owner Auth",
        detail: auth ? `Signed in as ${auth.user.display_name}` : "Waiting for local auth bootstrap",
        status: auth ? "ready" : bootstrapping ? "pending" : "warning",
      },
      {
        label: "Athlete Profile",
        detail: athlete ? `Bound to ${athlete.display_name}` : "No athlete profile selected yet",
        status: athlete ? "ready" : bootstrapping ? "pending" : "warning",
      },
      {
        label: "Model Artifact",
        detail: `${BASELINE_MODEL_VERSION} exported to TensorFlow Lite`,
        status: "ready",
      },
      {
        label: "Capture Pipeline",
        detail: "Simulation mode active. Native camera + frame processor bridge still pending.",
        status: "warning",
      },
    ],
    [athlete, auth, bootstrapping]
  );

  function resetSessionState() {
    setSessionId(null);
    setViewToken(null);
    setViewerShareUrl(null);
    setStats(emptyStats);
    setLastShot(null);
    setShots([]);
    setZones(defaultZones());
  }

  function stopController() {
    shotListenerCleanupRef.current?.();
    shotListenerCleanupRef.current = null;
    controllerRef.current?.stop();
    controllerRef.current = null;
  }

  async function refreshHistory(nextAuth?: AuthSession | null) {
    const activeAuth = nextAuth ?? auth;
    if (!activeAuth) return;
    try {
      setSessionHistory(await listSessions(activeAuth.accessToken));
    } catch {
      // History is secondary to the live session experience.
    }
  }

  async function bootstrap() {
    setBootstrapping(true);
    setError(null);
    try {
      const nextAuth = await loginDevUser(DEMO_PROFILE.displayName, DEMO_PROFILE.email);
      setAuth(nextAuth);

      const athletes = await listAthletes(nextAuth.accessToken);
      const nextAthlete =
        athletes[0] ?? (await createAthlete(nextAuth.accessToken, nextAuth.user.display_name));
      setAthlete(nextAthlete);
      await refreshHistory(nextAuth);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not initialize session owner.";
      setError(message);
      setPhase("error");
    } finally {
      setBootstrapping(false);
    }
  }

  async function runStart() {
    if (!auth || !athlete) {
      setError("The app is still setting up your athlete profile.");
      return;
    }

    stopController();
    resetSessionState();
    setPhase("starting");
    setError(null);
    setSessionStartTime(null);

    try {
      const credentials = await startSession(
        auth.accessToken,
        athlete.athlete_id,
        {
          platform: "expo-mobile",
          mode: "synthetic-baseline",
        },
        BASELINE_MODEL_VERSION
      );
      const controller = new TrainingSessionController();
      controllerRef.current = controller;

      shotListenerCleanupRef.current = controller.onShotEvent((shot, nextStats, nextZones) => {
        setLastShot(shot);
        setStats(nextStats);
        setZones(nextZones);
        setShots((current) => [...current, shot].slice(-300));
      });

      await controller.start(
        credentials.sessionId,
        credentials.publishToken,
        credentials.modelVersion ?? BASELINE_MODEL_VERSION,
        (message) => {
          setError(message);
        }
      );

      setSessionId(credentials.sessionId);
      setViewToken(credentials.viewToken);
      setViewerShareUrl(credentials.viewerShareUrl);
      setPhase("running");
      setSessionStartTime(Date.now());
      void refreshHistory();
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : "Could not start session. Check backend connection.";
      stopController();
      setError(message);
      setPhase("error");
    }
  }

  async function runStop() {
    if (!controllerRef.current || !sessionId || !viewToken) {
      setPhase("stopped");
      return;
    }

    stopController();

    try {
      const summary = await getSummary(sessionId, viewToken);
      setZones(summary.zone_breakdown);
      setStats({
        attempts: summary.attempts,
        makes: summary.makes,
        misses: summary.misses,
        fgPct: summary.fg_pct,
        avgLatency: summary.average_inference_latency_ms,
        currentStreak: summary.current_streak,
        bestStreak: summary.best_streak,
      });
      setShots(summaryShotsToInference(summary.shots));
    } catch {
      setError("Stopped session, but failed to load summary.");
    }

    setPhase("stopped");
    setSessionStartTime(null);
    void refreshHistory();
  }

  useEffect(() => {
    void bootstrap();
    return () => {
      stopController();
    };
  }, []);

  return {
    phase,
    sessionId,
    viewToken,
    viewerShareUrl,
    sessionStartTime,
    error,
    canStart,
    stats,
    lastShot,
    shots,
    zones,
    auth,
    athlete,
    sessionHistory,
    bootstrapping,
    readinessChecks,
    runtimeModeLabel: RUNTIME_MODE_LABEL,
    runtimeModeDetail: RUNTIME_MODE_DETAIL,
    runStart,
    runStop,
  };
}
