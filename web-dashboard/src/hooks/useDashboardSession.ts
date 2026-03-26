import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  AthleteProfile,
  AuthSession,
  SessionListItem,
  SessionSummary,
  ShotWireEvent,
  ZoneName,
  ZoneStat,
} from "../types/analytics";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const DEV_PROFILE = {
  displayName: "CourtVision Dashboard",
  email: "dashboard-demo@courtvision.local",
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

function defaultZones(): Record<ZoneName, ZoneStat> {
  return zoneNames.reduce(
    (acc, zone) => ({ ...acc, [zone]: { attempts: 0, makes: 0, percentage: 0 } }),
    {} as Record<ZoneName, ZoneStat>
  );
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function mapSummaryShotToWireEvent(shot: SessionSummary["shots"][number]): ShotWireEvent {
  return {
    session_id: shot.session_id,
    event_id: shot.event_id,
    sequence: shot.sequence,
    timestamp_ms: shot.timestamp_ms,
    client_sent_at_ms: shot.client_sent_at_ms ?? undefined,
    x_norm: shot.x_norm,
    y_norm: shot.y_norm,
    result: shot.result,
    confidence: shot.confidence,
    inference_latency_ms: shot.inference_latency_ms,
    model_version: shot.model_version ?? undefined,
    capture_quality: shot.capture_quality ?? undefined,
    zone: shot.zone,
    zone_breakdown: defaultZones(),
    session_stats: {
      attempts: 0,
      makes: 0,
      misses: 0,
      fg_pct: 0,
      avg_latency: 0,
      current_streak: 0,
      best_streak: 0,
    },
  };
}

export function useDashboardSession() {
  const [sessionId, setSessionId] = useState("");
  const [viewToken, setViewToken] = useState("");
  const [viewerShareUrl, setViewerShareUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [athleteName, setAthleteName] = useState("CourtVision Athlete");
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [makes, setMakes] = useState(0);
  const [misses, setMisses] = useState(0);
  const [fgPct, setFgPct] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [zones, setZones] = useState<Record<ZoneName, ZoneStat>>(defaultZones);
  const [feed, setFeed] = useState<ShotWireEvent[]>([]);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionListItem[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const canJoin = useMemo(
    () => sessionId.trim().length > 0 && viewToken.trim().length > 0,
    [sessionId, viewToken]
  );

  function resetLiveState() {
    setAttempts(0);
    setMakes(0);
    setMisses(0);
    setFgPct(0);
    setAvgLatency(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setZones(defaultZones());
    setFeed([]);
  }

  async function bootstrapAuth() {
    const response = await fetch(`${API_BASE_URL}/api/dev/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: DEV_PROFILE.displayName,
        email: DEV_PROFILE.email,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to bootstrap dashboard auth (${response.status})`);
    }
    const payload = (await response.json()) as {
      user_id: string;
      email: string;
      display_name: string;
      roles: string[];
      access_token: string;
      token_expires_at: string;
    };
    return {
      accessToken: payload.access_token,
      tokenExpiresAt: payload.token_expires_at,
      user: {
        user_id: payload.user_id,
        email: payload.email,
        display_name: payload.display_name,
        roles: payload.roles,
      },
    } satisfies AuthSession;
  }

  async function fetchAthletes(accessToken: string): Promise<AthleteProfile[]> {
    const response = await fetch(`${API_BASE_URL}/api/athletes`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(`Failed to load athletes (${response.status})`);
    }
    return (await response.json()) as AthleteProfile[];
  }

  async function createAthlete(accessToken: string, displayName: string): Promise<AthleteProfile> {
    const response = await fetch(`${API_BASE_URL}/api/athletes`, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ display_name: displayName }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create athlete (${response.status})`);
    }
    return (await response.json()) as AthleteProfile;
  }

  async function fetchHistory(accessToken: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/sessions`, {
      headers: authHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(`Failed to load session history (${response.status})`);
    }
    setSessionHistory((await response.json()) as SessionListItem[]);
  }

  async function ensureAthlete(accessToken: string, preferredName: string): Promise<AthleteProfile> {
    const athletes = await fetchAthletes(accessToken);
    const normalizedPreferredName = preferredName.trim().toLowerCase();
    const existing =
      athletes.find((candidate) => candidate.display_name.trim().toLowerCase() === normalizedPreferredName) ??
      athletes[0];
    if (existing) {
      return existing;
    }
    return createAthlete(accessToken, preferredName.trim() || "CourtVision Athlete");
  }

  async function fetchSummary(id: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/sessions/${id}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    setCurrentStreak(summary.current_streak);
    setBestStreak(summary.best_streak);
    setFeed(summary.shots.map(mapSummaryShotToWireEvent).slice(-24).reverse());
  }

  async function bootstrap() {
    setBootstrapping(true);
    setError("");
    try {
      const nextAuth = await bootstrapAuth();
      setAuth(nextAuth);
      setAthleteName(nextAuth.user.display_name);

      const nextAthlete = await ensureAthlete(nextAuth.accessToken, nextAuth.user.display_name);
      setAthlete(nextAthlete);
      await fetchHistory(nextAuth.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize dashboard");
    } finally {
      setBootstrapping(false);
    }
  }

  async function createAndJoinSession(): Promise<void> {
    if (!auth) {
      setError("Dashboard auth is still initializing.");
      return;
    }

    setError("");
    try {
      const activeAthlete = await ensureAthlete(auth.accessToken, athleteName);
      setAthlete(activeAthlete);

      const response = await fetch(`${API_BASE_URL}/api/sessions`, {
        method: "POST",
        headers: authHeaders(auth.accessToken),
        body: JSON.stringify({
          athlete_id: activeAthlete.athlete_id,
          model_version: "mock-shot-model/v1",
          device_info: { platform: "web-dashboard", mode: "dashboard-view" },
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create session (${response.status})`);
      }

      const payload = (await response.json()) as {
        session_id: string;
        view_token: string;
        viewer_share_url: string;
      };
      setSessionId(payload.session_id);
      setViewToken(payload.view_token);
      setViewerShareUrl(payload.viewer_share_url);
      joinSession(payload.session_id, payload.view_token, payload.viewer_share_url);
      await fetchHistory(auth.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }

  function joinSession(id?: string, tokenArg?: string, shareUrlArg?: string): void {
    const nextId = (id ?? sessionId).trim();
    const nextToken = (tokenArg ?? viewToken).trim();
    if (!nextId || !nextToken) return;

    resetLiveState();
    setError("");
    setConnected(false);
    setSessionId(nextId);
    setViewToken(nextToken);
    setViewerShareUrl(shareUrlArg ?? viewerShareUrl);
    setSessionStartTime(null);
    socketRef.current?.disconnect();

    const socket = io(API_BASE_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_session", { session_id: nextId, token: nextToken });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("error", (payload: { message?: string }) => {
      setError(payload.message ?? "Socket error");
      setConnected(false);
      setSessionStartTime(null);
      socket.disconnect();
    });

    socket.on("session_joined", async (payload: { session_id?: string }) => {
      if (payload.session_id !== nextId) {
        return;
      }

      setConnected(true);
      setSessionStartTime(Date.now());
      try {
        await fetchSummary(nextId, nextToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed summary refresh");
      }
    });

    socket.on("shot_event", (event: ShotWireEvent) => {
      setAttempts(event.session_stats.attempts);
      setMakes(event.session_stats.makes);
      setMisses(event.session_stats.misses);
      setFgPct(event.session_stats.fg_pct);
      setAvgLatency(event.session_stats.avg_latency);
      setCurrentStreak(event.session_stats.current_streak);
      setBestStreak(event.session_stats.best_streak);
      setZones(event.zone_breakdown);
      setFeed((prev) => [event, ...prev].slice(0, 24));
    });
  }

  function disconnect(): void {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setSessionStartTime(null);
    resetLiveState();
  }

  useEffect(() => {
    void bootstrap();

    const searchParams = new URLSearchParams(window.location.search);
    const sharedSessionId = searchParams.get("sessionId");
    const sharedToken = searchParams.get("token");
    if (sharedSessionId && sharedToken) {
      setSessionId(sharedSessionId);
      setViewToken(sharedToken);
      joinSession(sharedSessionId, sharedToken, window.location.href);
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    sessionId,
    viewToken,
    viewerShareUrl,
    setViewToken,
    connected,
    athleteName,
    setAthleteName,
    athlete,
    auth,
    bootstrapping,
    sessionHistory,
    sessionStartTime,
    attempts,
    makes,
    misses,
    fgPct,
    avgLatency,
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
