import { useEffect, useMemo, useRef, useState } from "react";
import { getSummary, startSession } from "../services/api";
import { TrainingSessionController } from "../services/trainingSession";
import { SessionStats, ShotInference, ZoneName, ZoneStat } from "../types/analytics";

type SessionPhase = "idle" | "starting" | "running" | "stopped" | "error";

const emptyStats: SessionStats = {
  attempts: 0,
  makes: 0,
  misses: 0,
  fgPct: 0,
  avgLatency: 0,
  avgFormScore: 0,
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

export function useCourtVisionSession(athleteId: string) {
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [lastShot, setLastShot] = useState<ShotInference | null>(null);
  const [zones, setZones] = useState<Record<ZoneName, ZoneStat>>(defaultZones);
  const controllerRef = useRef<TrainingSessionController | null>(null);

  const canStart = useMemo(() => phase === "idle" || phase === "stopped", [phase]);

  async function runStart() {
    setPhase("starting");
    setError(null);

    try {
      const id = await startSession(athleteId);
      const controller = new TrainingSessionController();
      controllerRef.current = controller;

      controller.onShotEvent((shot, nextStats) => {
        setLastShot(shot);
        setStats(nextStats);
      });

      await controller.start(id, (message) => {
        setError(message);
        setPhase("error");
      });

      setSessionId(id);
      setPhase("running");
    } catch {
      setError("Could not start session. Check backend connection.");
      setPhase("error");
    }
  }

  async function runStop() {
    const active = controllerRef.current;
    if (!active || !sessionId) {
      setPhase("stopped");
      return;
    }

    active.stop();
    controllerRef.current = null;

    try {
      const summary = await getSummary(sessionId);
      setZones(summary.zone_breakdown);
      setStats({
        attempts: summary.attempts,
        makes: summary.makes,
        misses: summary.misses,
        fgPct: summary.fg_pct,
        avgLatency: summary.average_inference_latency_ms,
        avgFormScore: summary.average_form_score,
        currentStreak: summary.current_streak,
        bestStreak: summary.best_streak,
      });
    } catch {
      setError("Stopped session, but failed to load summary.");
    }

    setPhase("stopped");
  }

  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  return {
    phase,
    sessionId,
    error,
    canStart,
    stats,
    lastShot,
    zones,
    runStart,
    runStop,
  };
}
