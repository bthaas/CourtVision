import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SessionSummary, ShotWireEvent, ZoneName, ZoneStat } from "../types/analytics";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

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

function defaultZones(): Record<ZoneName, ZoneStat> {
  return zoneNames.reduce(
    (acc, zone) => ({ ...acc, [zone]: { attempts: 0, makes: 0, percentage: 0 } }),
    {} as Record<ZoneName, ZoneStat>
  );
}

export function useDashboardSession() {
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [athleteName, setAthleteName] = useState("Demo Athlete");
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [makes, setMakes] = useState(0);
  const [misses, setMisses] = useState(0);
  const [fgPct, setFgPct] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [avgFormScore, setAvgFormScore] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [zones, setZones] = useState<Record<ZoneName, ZoneStat>>(defaultZones);
  const [feed, setFeed] = useState<ShotWireEvent[]>([]);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const canJoin = useMemo(() => sessionId.trim().length > 0, [sessionId]);

  async function fetchSummary(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${id}/summary`);
    if (!response.ok) {
      throw new Error(`Failed to fetch summary (${response.status})`);
    }
    const summary = (await response.json()) as SessionSummary;
    setZones(summary.zone_breakdown);
    setAttempts(summary.attempts);
    setMakes(summary.makes);
    setMisses(summary.misses);
    setFgPct(summary.fg_pct);
    setAvgLatency(summary.average_inference_latency_ms);
    setAvgFormScore(summary.average_form_score);
    setCurrentStreak(summary.current_streak);
    setBestStreak(summary.best_streak);
  }

  async function createAndJoinSession(): Promise<void> {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athlete_id: athleteName || "web-dashboard" }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create session (${response.status})`);
      }

      const payload = (await response.json()) as { session_id: string };
      setSessionId(payload.session_id);
      joinSession(payload.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }

  function joinSession(id?: string): void {
    const nextId = (id ?? sessionId).trim();
    if (!nextId) return;

    setError("");
    setSessionStartTime(Date.now());
    socketRef.current?.disconnect();

    const socket = io(API_BASE_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", async () => {
      setConnected(true);
      socket.emit("join_session", { session_id: nextId });
      try {
        await fetchSummary(nextId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed summary refresh");
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("error", (payload: { message?: string }) => {
      setError(payload.message ?? "Socket error");
    });

    socket.on("shot_event", (event: ShotWireEvent) => {
      setAttempts(event.session_stats.attempts);
      setMakes(event.session_stats.makes);
      setMisses(event.session_stats.misses);
      setFgPct(event.session_stats.fg_pct);
      setAvgLatency(event.session_stats.avg_latency);
      setAvgFormScore(event.session_stats.avg_form_score);
      setCurrentStreak(event.session_stats.current_streak);
      setBestStreak(event.session_stats.best_streak);
      setFeed((prev) => [event, ...prev].slice(0, 24));
      fetchSummary(event.session_id).catch(() => {
        setError("Live update received, summary refresh failed.");
      });
    });
  }

  function disconnect(): void {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setSessionStartTime(null);
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    sessionId,
    connected,
    athleteName,
    setAthleteName,
    sessionStartTime,
    attempts,
    makes,
    misses,
    fgPct,
    avgLatency,
    avgFormScore,
    currentStreak,
    bestStreak,
    zones,
    feed,
    error,
    setSessionId,
    canJoin,
    createAndJoinSession,
    joinSession,
    disconnect,
  };
}
